import { NextResponse } from "next/server";
import { bad, guard, readJson } from "@/lib/admin-route";
import { createQuestion, existingTexts, listQuestions } from "@/lib/questions";
import { validateQuestion } from "@/lib/validate";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json({ ok: true, questions: await listQuestions() });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const v = validateQuestion(await readJson(req));
  if (!v.ok) return bad(v.errors);
  if ((await existingTexts()).has(v.value.text.toLowerCase())) return bad("A question with this exact text already exists.");
  return NextResponse.json({ ok: true, question: await createQuestion(v.value) });
}
