import { NextResponse } from "next/server";
import { isAdmin, refreshAdminCookie } from "@/lib/auth";

/** Keep-alive: extends the 30-min idle window while the admin is active. */
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  await refreshAdminCookie();
  return NextResponse.json({ ok: true });
}
