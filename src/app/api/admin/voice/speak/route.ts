import { bad, guard, readJson } from "@/lib/admin-route";
import { MAX_TTS_CHARS, isCached, speak, ttsResponse } from "@/lib/voice";

/**
 * Admin TTS: "Test" button and "Pre-generate all" (one clip per request to stay within Vercel time limits).
 * Body: { text: string, checkOnly?: boolean }
 */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const b = ((await readJson(req)) ?? {}) as { text?: unknown; checkOnly?: unknown };
  if (typeof b.text !== "string" || !b.text.trim()) return bad("text required");
  if (b.text.length > MAX_TTS_CHARS) return bad(`text over ${MAX_TTS_CHARS} chars`);
  try {
    if (b.checkOnly) return Response.json({ ok: true, cached: await isCached(b.text) });
    return ttsResponse(await speak(b.text));
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
