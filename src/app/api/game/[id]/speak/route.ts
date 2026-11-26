import { NextResponse } from "next/server";
import { chargeTts } from "@/lib/game";
import { MAX_TTS_CHARS, speak, ttsResponse } from "@/lib/voice";
import { errorResponse } from "@/lib/game-http";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Host voice for a running game. Requires a valid game id and is capped per game,
 * so the public endpoint can't be used to burn ElevenLabs credits.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > MAX_TTS_CHARS) {
      return NextResponse.json({ ok: false, error: "Bad text." }, { status: 400 });
    }
    if (!(await chargeTts(id))) return NextResponse.json({ ok: false, error: "Voice limit reached." }, { status: 429 });
    return ttsResponse(await speak(body.text));
  } catch (e) {
    if (e instanceof Error && /Voice disabled|ElevenLabs/.test(e.message)) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
    }
    return errorResponse(e);
  }
}
