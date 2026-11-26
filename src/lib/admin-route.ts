import "server-only";
import { NextResponse } from "next/server";
import { isAdmin, refreshAdminCookie } from "./auth";

/** Guard for admin API routes. Returns a 401 response, or null after extending the idle window. */
export async function guard(): Promise<NextResponse | null> {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  await refreshAdminCookie();
  return null;
}

export const bad = (errors: string[] | string, status = 400) =>
  NextResponse.json({ ok: false, errors: Array.isArray(errors) ? errors : [errors] }, { status });

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
