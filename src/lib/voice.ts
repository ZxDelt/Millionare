import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getRaw, setRaw } from "./settings";
import { open, seal } from "./secret-box";

/**
 * ElevenLabs voice (GDD §7.1). The API key is stored encrypted in `settings` and never sent to the browser.
 * Clips are cached by hash(voice + model + text): Vercel Blob in production, data/tts-cache locally.
 */
const API = "https://api.elevenlabs.io/v1";
export const TTS_MODEL = "eleven_multilingual_v2";
const KEY_SETTING = "voice";

interface StoredVoice {
  apiKeySealed?: string;
  voiceId?: string;
  voiceName?: string;
}

export interface VoiceStatus {
  hasKey: boolean;
  keyHint: string | null;
  voiceId: string | null;
  voiceName: string | null;
}

async function load(): Promise<StoredVoice> {
  const raw = await getRaw(KEY_SETTING);
  return raw ? (JSON.parse(raw) as StoredVoice) : {};
}

async function apiKey(): Promise<string | null> {
  const v = await load();
  return v.apiKeySealed ? open(v.apiKeySealed) : null;
}

export async function voiceStatus(): Promise<VoiceStatus> {
  const v = await load();
  const k = v.apiKeySealed ? open(v.apiKeySealed) : null;
  return {
    hasKey: !!k,
    keyHint: k ? `••••${k.slice(-4)}` : null,
    voiceId: v.voiceId ?? null,
    voiceName: v.voiceName ?? null,
  };
}

export async function saveVoice(patch: { apiKey?: string | null; voiceId?: string | null; voiceName?: string | null }) {
  const v = await load();
  if ("apiKey" in patch) v.apiKeySealed = patch.apiKey ? seal(patch.apiKey.trim()) : undefined;
  if ("voiceId" in patch) v.voiceId = patch.voiceId?.trim() || undefined;
  if ("voiceName" in patch) v.voiceName = patch.voiceName?.trim() || undefined;
  await setRaw(KEY_SETTING, JSON.stringify(v));
}

export async function isVoiceEnabled(): Promise<boolean> {
  return !!(await apiKey());
}

export interface VoiceOption {
  id: string;
  name: string;
  previewUrl: string | null;
  labels: string;
}

export async function listVoices(): Promise<VoiceOption[]> {
  const key = await apiKey();
  if (!key) throw new Error("No ElevenLabs API key saved.");
  const res = await fetch(`${API}/voices`, { headers: { "xi-api-key": key }, cache: "no-store" });
  if (!res.ok) throw new Error(`ElevenLabs voices request failed (${res.status}).`);
  const data = (await res.json()) as {
    voices?: { voice_id: string; name: string; preview_url?: string; labels?: Record<string, string> }[];
  };
  return (data.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url ?? null,
    labels: Object.values(v.labels ?? {}).join(", "),
  }));
}

async function resolveVoiceId(): Promise<string> {
  const v = await load();
  if (v.voiceId) return v.voiceId;
  // No voice chosen yet (final choice is on hold): use the account's first voice.
  const voices = await listVoices();
  if (!voices.length) throw new Error("This ElevenLabs account has no voices.");
  return voices[0].id;
}

// ---------- cache ----------
const LOCAL_DIR = join(process.cwd(), "data", "tts-cache");
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

const cacheKey = (voiceId: string, text: string) =>
  createHash("sha256").update(`${voiceId}|${TTS_MODEL}|${text}`).digest("hex").slice(0, 40);

export type TtsResult = { kind: "bytes"; data: Buffer } | { kind: "url"; url: string };

async function cacheGet(key: string): Promise<TtsResult | null> {
  if (useBlob()) {
    const { head } = await import("@vercel/blob");
    try {
      const h = await head(`tts/${key}.mp3`);
      return { kind: "url", url: h.url };
    } catch {
      return null;
    }
  }
  try {
    return { kind: "bytes", data: await readFile(join(LOCAL_DIR, `${key}.mp3`)) };
  } catch {
    return null;
  }
}

async function cachePut(key: string, data: Buffer): Promise<TtsResult> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const b = await put(`tts/${key}.mp3`, data, {
      access: "public",
      contentType: "audio/mpeg",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { kind: "url", url: b.url };
  }
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(join(LOCAL_DIR, `${key}.mp3`), data);
  return { kind: "bytes", data };
}

export const MAX_TTS_CHARS = 500;

/** Returns cached audio or generates it. Throws if voice is disabled or ElevenLabs fails. */
export async function speak(text: string): Promise<TtsResult> {
  const clean = text.trim().slice(0, MAX_TTS_CHARS);
  const key = await apiKey();
  if (!key) throw new Error("Voice disabled.");
  const voiceId = await resolveVoiceId();
  const ck = cacheKey(voiceId, clean);
  const hit = await cacheGet(ck);
  if (hit) return hit;

  const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: clean, model_id: TTS_MODEL }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed (${res.status}).`);
  return cachePut(ck, Buffer.from(await res.arrayBuffer()));
}

export async function isCached(text: string): Promise<boolean> {
  if (!(await apiKey())) return false;
  const voiceId = await resolveVoiceId();
  return !!(await cacheGet(cacheKey(voiceId, text.trim().slice(0, MAX_TTS_CHARS))));
}

export async function cacheStats(): Promise<{ files: number; bytes: number; store: "blob" | "local" }> {
  if (useBlob()) {
    const { list } = await import("@vercel/blob");
    let files = 0, bytes = 0, cursor: string | undefined;
    do {
      const r = await list({ prefix: "tts/", cursor });
      files += r.blobs.length;
      bytes += r.blobs.reduce((a, b) => a + b.size, 0);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return { files, bytes, store: "blob" };
  }
  try {
    const names = await readdir(LOCAL_DIR);
    let bytes = 0;
    for (const n of names) bytes += (await stat(join(LOCAL_DIR, n))).size;
    return { files: names.length, bytes, store: "local" };
  } catch {
    return { files: 0, bytes: 0, store: "local" };
  }
}

export async function clearCache(): Promise<void> {
  if (useBlob()) {
    const { list, del } = await import("@vercel/blob");
    let cursor: string | undefined;
    do {
      const r = await list({ prefix: "tts/", cursor });
      if (r.blobs.length) await del(r.blobs.map((b) => b.url));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return;
  }
  await rm(LOCAL_DIR, { recursive: true, force: true });
}

export function ttsResponse(r: TtsResult): Response {
  if (r.kind === "url") return Response.redirect(r.url, 302);
  return new Response(new Uint8Array(r.data), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
  });
}
