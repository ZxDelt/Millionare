import { NextResponse } from "next/server";
import { act, getGame } from "@/lib/game";
import type { GameAction } from "@/lib/game-types";
import { errorResponse } from "@/lib/game-http";

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS = new Set(["begin", "select", "confirm", "cancel", "lifeline", "resume", "walkAway", "next", "timeout"]);

export async function GET(_req: Request, { params }: Ctx) {
  try {
    return NextResponse.json({ ok: true, state: await getGame((await params).id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.type !== "string" || !ACTIONS.has(body.type)) {
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, state: await act((await params).id, body as unknown as GameAction) });
  } catch (e) {
    return errorResponse(e);
  }
}
