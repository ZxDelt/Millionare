import { NextResponse } from "next/server";
import { startGame } from "@/lib/game";
import { errorResponse } from "@/lib/game-http";
import { isVoiceEnabled } from "@/lib/voice";

/** Start a new game. Body: { name } */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: unknown };
    const state = await startGame(typeof body.name === "string" ? body.name : "");
    return NextResponse.json({ ok: true, state, voice: await isVoiceEnabled() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Public config for the title screen. */
export async function GET() {
  return NextResponse.json({ ok: true, voice: await isVoiceEnabled() });
}

