import { NextResponse } from "next/server";
import { bad, guard } from "@/lib/admin-route";
import { listVoices } from "@/lib/voice";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, voices: await listVoices() });
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
