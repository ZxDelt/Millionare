import "server-only";
import { getDb } from "./db";
import type { CategoryId, Difficulty, QuestionStatus } from "./constants";
import type { QuestionInput } from "./validate";

export interface Question {
  id: number;
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  difficulty: Difficulty | null;
  category: CategoryId;
  explanation: string;
  status: QuestionStatus;
  timesUsed: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = Record<string, unknown>;
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

export function rowToQuestion(r: Row): Question {
  return {
    id: Number(r.id),
    text: String(r.text),
    options: JSON.parse(String(r.options)),
    correctIndex: Number(r.correct_index),
    difficulty: (r.difficulty as Difficulty | null) ?? null,
    category: r.category as CategoryId,
    explanation: String(r.explanation ?? ""),
    status: r.status as QuestionStatus,
    timesUsed: Number(r.times_used ?? 0),
    lastUsedAt: (r.last_used_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listQuestions(): Promise<Question[]> {
  const db = await getDb();
  const r = await db.execute("SELECT * FROM questions ORDER BY id");
  return r.rows.map((row) => rowToQuestion(row as unknown as Row));
}

export async function getQuestion(id: number): Promise<Question | null> {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT * FROM questions WHERE id = ?", args: [id] });
  return r.rows.length ? rowToQuestion(r.rows[0] as unknown as Row) : null;
}

const insertStmt = (q: QuestionInput) => ({
  sql: `INSERT INTO questions (text, options, correct_index, difficulty, category, explanation, status)
        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  args: [q.text, JSON.stringify(q.options), q.correctIndex, q.difficulty, q.category, q.explanation, q.status],
});

export async function createQuestion(q: QuestionInput): Promise<Question> {
  const db = await getDb();
  const r = await db.execute(insertStmt(q));
  return rowToQuestion(r.rows[0] as unknown as Row);
}

export async function createQuestions(qs: QuestionInput[]): Promise<number> {
  if (!qs.length) return 0;
  const db = await getDb();
  await db.batch(qs.map(insertStmt), "write");
  return qs.length;
}

export async function updateQuestion(id: number, q: QuestionInput): Promise<Question | null> {
  const db = await getDb();
  const r = await db.execute({
    sql: `UPDATE questions SET text=?, options=?, correct_index=?, difficulty=?, category=?, explanation=?, status=?,
          updated_at=${NOW} WHERE id=? RETURNING *`,
    args: [q.text, JSON.stringify(q.options), q.correctIndex, q.difficulty, q.category, q.explanation, q.status, id],
  });
  return r.rows.length ? rowToQuestion(r.rows[0] as unknown as Row) : null;
}

/** Quick-tag / status toggle without resending the whole question. */
export async function patchQuestion(
  id: number,
  patch: { difficulty?: Difficulty | null; status?: QuestionStatus },
): Promise<Question | null> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if ("difficulty" in patch) { sets.push("difficulty=?"); args.push(patch.difficulty ?? null); }
  if ("status" in patch) { sets.push("status=?"); args.push(patch.status!); }
  if (!sets.length) return getQuestion(id);
  const db = await getDb();
  const r = await db.execute({
    sql: `UPDATE questions SET ${sets.join(", ")}, updated_at=${NOW} WHERE id=? RETURNING *`,
    args: [...args, id],
  });
  return r.rows.length ? rowToQuestion(r.rows[0] as unknown as Row) : null;
}

export async function deleteQuestion(id: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.execute({ sql: "DELETE FROM questions WHERE id = ?", args: [id] });
  return r.rowsAffected > 0;
}

export async function existingTexts(): Promise<Set<string>> {
  const db = await getDb();
  const r = await db.execute("SELECT text FROM questions");
  return new Set(r.rows.map((x) => String(x.text).trim().toLowerCase()));
}

export interface Coverage {
  easy: number;
  medium: number;
  hard: number;
  untagged: number;
  active: number;
  total: number;
}

export async function getCoverage(): Promise<Coverage> {
  const db = await getDb();
  const r = await db.execute(`
    SELECT
      SUM(CASE WHEN status='active' AND difficulty='easy'   THEN 1 ELSE 0 END) AS easy,
      SUM(CASE WHEN status='active' AND difficulty='medium' THEN 1 ELSE 0 END) AS medium,
      SUM(CASE WHEN status='active' AND difficulty='hard'   THEN 1 ELSE 0 END) AS hard,
      SUM(CASE WHEN status='active' AND difficulty IS NULL  THEN 1 ELSE 0 END) AS untagged,
      SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
      COUNT(*) AS total
    FROM questions`);
  const row = r.rows[0] as unknown as Row;
  const n = (k: string) => Number(row?.[k] ?? 0);
  return { easy: n("easy"), medium: n("medium"), hard: n("hard"), untagged: n("untagged"), active: n("active"), total: n("total") };
}
