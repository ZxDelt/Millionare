import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPassword, cookieOptions, makeToken } from "@/lib/auth";

export async function POST(req: Request) {
  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    /* empty or invalid body → treated as wrong password */
  }

  if (!password || !checkPassword(password)) {
    // Brute-force brake. Per-request delay works on serverless (no shared memory needed).
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeToken(), cookieOptions);
  return res;
}
