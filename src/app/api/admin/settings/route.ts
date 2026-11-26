import { NextResponse } from "next/server";
import { bad, guard, readJson } from "@/lib/admin-route";
import { DEFAULT_SETTINGS, getSettings, saveSettings, validateSettings } from "@/lib/settings";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json({ ok: true, settings: await getSettings(), defaults: DEFAULT_SETTINGS });
}

export async function PUT(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const v = validateSettings(await readJson(req));
  if (!v.ok) return bad(v.errors);
  await saveSettings(v.value);
  return NextResponse.json({ ok: true, settings: v.value });
}
