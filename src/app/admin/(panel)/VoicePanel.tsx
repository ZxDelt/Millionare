"use client";
import { useRef, useState } from "react";
import type { VoiceOption, VoiceStatus } from "@/lib/voice";
import { explanationSpeech, questionSpeech } from "@/lib/speech";
import { staticLines } from "@/lib/host-lines";

interface Cache { files: number; bytes: number; store: "blob" | "local" }

export default function VoicePanel({ initialStatus, initialCache }: { initialStatus: VoiceStatus; initialCache: Cache }) {
  const [status, setStatus] = useState(initialStatus);
  const [cache, setCache] = useState(initialCache);
  const [keyInput, setKeyInput] = useState("");
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [voiceId, setVoiceId] = useState(initialStatus.voiceId ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; chars: number } | null>(null);
  const stopRef = useRef(false);

  async function put(body: object) {
    const res = await fetch("/api/admin/voice", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok) setStatus(data.status);
    return data;
  }

  async function saveKey() {
    if (!keyInput.trim()) return;
    const d = await put({ apiKey: keyInput.trim() });
    setKeyInput("");
    setMsg(d.ok ? { kind: "ok", text: "API key saved (encrypted). Loading voices…" } : { kind: "err", text: "Could not save key." });
    if (d.ok) loadVoices();
  }

  async function clearKey() {
    if (!confirm("Remove the ElevenLabs API key? The host will go back to speech bubbles only.")) return;
    await put({ apiKey: null });
    setVoices(null);
    setMsg({ kind: "ok", text: "API key removed." });
  }

  async function loadVoices() {
    const data = await (await fetch("/api/admin/voice/voices")).json();
    if (data.ok) { setVoices(data.voices); setMsg(null); }
    else { setVoices([]); setMsg({ kind: "err", text: `${data.errors?.join(" ")} You can still type a Voice ID manually.` }); }
  }

  async function saveVoice() {
    const name = voices?.find((v) => v.id === voiceId)?.name ?? null;
    const d = await put({ voiceId: voiceId || null, voiceName: name });
    setMsg(d.ok ? { kind: "ok", text: voiceId ? "Voice saved." : "Voice cleared — the account's first voice will be used." } : { kind: "err", text: "Save failed." });
  }

  async function test() {
    setMsg({ kind: "ok", text: "Generating sample…" });
    const res = await fetch("/api/admin/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Welcome to JOULE JACKPOT, the energy quiz show!" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg({ kind: "err", text: d.errors?.join(" ") ?? "Test failed." });
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    new Audio(url).play();
    setMsg({ kind: "ok", text: "Playing sample." });
    refreshCache();
  }

  async function refreshCache() {
    const d = await (await fetch("/api/admin/voice")).json();
    if (d.ok) setCache(d.cache);
  }

  async function clearCacheAll() {
    if (!confirm("Delete all generated voice clips? They will be regenerated (and use ElevenLabs credits) when needed.")) return;
    const d = await (await fetch("/api/admin/voice", { method: "DELETE" })).json();
    if (d.ok) setCache(d.cache);
  }

  async function texts(): Promise<string[]> {
    const d = await (await fetch("/api/admin/questions")).json();
    const qs = (d.questions ?? []) as { text: string; options: string[]; explanation: string; status: string }[];
    const out = new Set<string>(staticLines());
    qs.filter((q) => q.status === "active").forEach((q) => {
      out.add(questionSpeech(q.text, q.options));
      if (q.explanation) out.add(explanationSpeech(q.explanation));
    });
    return [...out];
  }

  async function pregenerate() {
    const all = await texts();
    const chars = all.reduce((a, t) => a + t.length, 0);
    if (!confirm(`Pre-generate up to ${all.length} clips (~${chars.toLocaleString()} characters of ElevenLabs credit, minus clips already cached)?`)) return;
    stopRef.current = false;
    setProgress({ done: 0, total: all.length, chars: 0 });
    let failed = 0, spent = 0;
    for (let i = 0; i < all.length && !stopRef.current; i++) {
      const body = (extra: object) => JSON.stringify({ text: all[i], ...extra });
      const headers = { "Content-Type": "application/json" };
      const chk = await (await fetch("/api/admin/voice/speak", { method: "POST", headers, body: body({ checkOnly: true }) })).json().catch(() => ({}));
      if (!chk.cached) {
        const r = await fetch("/api/admin/voice/speak", { method: "POST", headers, body: body({}) });
        if (!r.ok) failed++;
        else spent += all[i].length;
      }
      setProgress({ done: i + 1, total: all.length, chars: spent });
    }
    setProgress(null);
    setMsg({ kind: failed ? "err" : "ok", text: `Pre-generation ${stopRef.current ? "stopped" : "finished"}. ${spent.toLocaleString()} characters generated${failed ? `, ${failed} failed` : ""}.` });
    refreshCache();
  }

  return (
    <section className="card section">
      <h2>Host voice (ElevenLabs)</h2>
      <p className="muted">
        Without a key the host talks in speech bubbles. With a key, the pixel host speaks and his mouth moves with the audio.
        The key is stored encrypted on the server and never sent to players.
      </p>
      {msg && <div className={`notice ${msg.kind}`} role="status">{msg.text}</div>}

      <div className="fields">
        <label className="field wide">
          <span>API key {status.hasKey && <b className="ok-text">· saved {status.keyHint}</b>}</span>
          <div className="toolbar">
            <input
              className="input"
              type="password"
              autoComplete="off"
              placeholder={status.hasKey ? "Paste a new key to replace" : "Paste ElevenLabs API key"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <button className="btn btn-primary" onClick={saveKey} disabled={!keyInput.trim()}>Save key</button>
            {status.hasKey && <button className="btn btn-danger" onClick={clearKey}>Remove</button>}
          </div>
        </label>
      </div>

      {status.hasKey && (
        <>
          <div className="fields">
            <label className="field wide">
              <span>Host voice {status.voiceName ? `· current: ${status.voiceName}` : status.voiceId ? `· current: ${status.voiceId}` : "· not chosen (account's first voice is used)"}</span>
              <div className="toolbar">
                {voices && voices.length > 0 ? (
                  <select className="input" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                    <option value="">— default (first voice) —</option>
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}{v.labels ? ` — ${v.labels}` : ""}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input" placeholder="Voice ID" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} />
                )}
                {!voices && <button className="btn" onClick={loadVoices}>Load voices</button>}
                {voices?.find((v) => v.id === voiceId)?.previewUrl && (
                  <button className="btn" onClick={() => new Audio(voices.find((v) => v.id === voiceId)!.previewUrl!).play()}>▶ Preview</button>
                )}
                <button className="btn btn-primary" onClick={saveVoice}>Save voice</button>
              </div>
            </label>
          </div>
          <div className="toolbar">
            <button className="btn" onClick={test}>Test voice</button>
            {progress ? (
              <>
                <span className="muted">Generating {progress.done}/{progress.total} · {progress.chars.toLocaleString()} chars</span>
                <button className="btn btn-danger" onClick={() => (stopRef.current = true)}>Stop</button>
              </>
            ) : (
              <button className="btn" onClick={pregenerate}>Pre-generate all voice</button>
            )}
          </div>
        </>
      )}

      <p className="muted small">
        Voice cache ({cache.store === "blob" ? "Vercel Blob" : "local disk"}): {cache.files} clips · {(cache.bytes / 1024 / 1024).toFixed(1)} MB{" "}
        {cache.files > 0 && <button className="link" onClick={clearCacheAll}>Clear cache</button>}
      </p>
    </section>
  );
}
