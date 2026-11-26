import "server-only";
import { NextResponse } from "next/server";
import { GameError } from "./game-engine";

export function errorResponse(e: unknown) {
  if (e instanceof GameError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}
