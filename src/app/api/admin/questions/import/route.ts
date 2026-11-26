import { NextResponse } from "next/server";
import { bad, guard, readJson } from "@/lib/admin-route";
import { createQuestions, existingTexts } from "@/lib/questions";
import { validateQuestion, type QuestionInput } from "@/lib/validate";
import { CSV_HEADER, parseCsv } from "@/lib/csv";

/**
 * Import questions (append only). Body: { format: "json" | "csv", data: string }.
 * JSON: array of {text, options[4], correctIndex, difficulty, category, explanation, status?}.
 * CSV: header row = text,optionA..D,correct(A-D),difficulty,category,explanation,status.
 * Duplicates (same text as an existing question or earlier in the file) are skipped.
 */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = ((await readJson(req)) ?? {}) as { format?: string; data?: string };
  if (typeof body.data !== "string" || !body.data.trim()) return bad("No data.");
  if (body.data.length > 2_000_000) return bad("File too large (2 MB max).");

  let items: unknown[];
  try {
    items = body.format === "csv" ? csvToItems(body.data) : (JSON.parse(body.data) as unknown[]);
    if (!Array.isArray(items)) throw new Error("JSON must be an array of questions.");
  } catch (e) {
    return bad(`Could not parse file: ${(e as Error).message}`);
  }

  const seen = await existingTexts();
  const good: QuestionInput[] = [];
  const errors: string[] = [];
  let duplicates = 0;
  items.forEach((item, i) => {
    const v = validateQuestion(item);
    if (!v.ok) {
      errors.push(`Row ${i + 1}: ${v.errors.join(" ")}`);
      return;
    }
    const key = v.value.text.toLowerCase();
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key);
    good.push(v.value);
  });

  const imported = await createQuestions(good);
  return NextResponse.json({ ok: true, imported, duplicates, errors: errors.slice(0, 50), errorCount: errors.length });
}

function csvToItems(data: string): unknown[] {
  const rows = parseCsv(data);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  const idx = (k: string) => header.indexOf(k);
  const missing = CSV_HEADER.filter((k) => k !== "status" && idx(k) < 0);
  if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(", ")}`);
  return rows.slice(1).map((r) => {
    const get = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? "").trim() : "");
    const correct = get("correct").toUpperCase();
    return {
      text: get("text"),
      options: [get("optionA"), get("optionB"), get("optionC"), get("optionD")],
      correctIndex: "ABCD".indexOf(correct) >= 0 && correct.length === 1 ? "ABCD".indexOf(correct) : Number(correct),
      difficulty: get("difficulty").toLowerCase() || null,
      category: get("category"),
      explanation: get("explanation"),
      status: get("status") || "active",
    };
  });
}
