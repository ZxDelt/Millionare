import { NextResponse } from "next/server";
import { bad, guard, parseId, readJson } from "@/lib/admin-route";
import { deleteQuestion, patchQuestion, updateQuestion } from "@/lib/questions";
import { validateQuestion } from "@/lib/validate";
import { DIFFICULTIES, QUESTION_STATUSES, type Difficulty, type QuestionStatus } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await guard();
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("Bad id");
  const v = validateQuestion(await readJson(req));
  if (!v.ok) return bad(v.errors);
  const q = await updateQuestion(id, v.value);
  return q ? NextResponse.json({ ok: true, question: q }) : bad("Not found", 404);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await guard();
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("Bad id");
  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const patch: { difficulty?: Difficulty | null; status?: QuestionStatus } = {};
  if ("difficulty" in body) {
    if (body.difficulty === null || body.difficulty === "") patch.difficulty = null;
    else if ((DIFFICULTIES as readonly string[]).includes(String(body.difficulty))) patch.difficulty = body.difficulty as Difficulty;
    else return bad("Bad difficulty");
  }
  if ("status" in body) {
    if (!(QUESTION_STATUSES as readonly string[]).includes(String(body.status))) return bad("Bad status");
    patch.status = body.status as QuestionStatus;
  }
  const q = await patchQuestion(id, patch);
  return q ? NextResponse.json({ ok: true, question: q }) : bad("Not found", 404);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await guard();
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("Bad id");
  return (await deleteQuestion(id)) ? NextResponse.json({ ok: true }) : bad("Not found", 404);
}
