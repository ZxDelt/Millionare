import { NextResponse } from "next/server";
import { bad, guard, readJson } from "@/lib/admin-route";
import { cacheStats, clearCache, saveVoice, voiceStatus } from "@/lib/voice";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const [status, cache] = await Promise.all([voiceStatus(), cacheStats()]);
  return NextResponse.json({ ok: true, status, cache });
}

/** Body: { apiKey?: string|null, voiceId?: string|null, voiceName?: string|null }. apiKey null clears it. */
export async function PUT(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const b = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const patch: Parameters<typeof saveVoice>[0] = {};
  for (const k of ["apiKey", "voiceId", "voiceName"] as const) {
    if (k in b) {
      if (b[k] !== null && typeof b[k] !== "string") return bad(`${k} must be a string or null.`);
      if (typeof b[k] === "string" && (b[k] as string).length > 200) return bad(`${k} is too long.`);
      patch[k] = b[k] as string | null;
    }
  }
  await saveVoice(patch);
  return NextResponse.json({ ok: true, status: await voiceStatus() });
}

export async function DELETE() {
  const denied = await guard();
  if (denied) return denied;
  await clearCache();
  return NextResponse.json({ ok: true, cache: await cacheStats() });
}
