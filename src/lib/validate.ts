import { CATEGORIES, DIFFICULTIES, QUESTION_STATUSES, type CategoryId, type Difficulty, type QuestionStatus } from "./constants";

/** Shared (client + server) question validation. GDD §10.2/10.3. */
export const LIMITS = { text: 140, option: 40, explanation: 300 } as const;

export interface QuestionInput {
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  difficulty: Difficulty | null;
  category: CategoryId;
  explanation: string;
  status: QuestionStatus;
}

export type ValidationResult = { ok: true; value: QuestionInput } | { ok: false; errors: string[] };

const CAT_IDS = CATEGORIES.map((c) => c.id) as readonly string[];

export function validateQuestion(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const o = (raw ?? {}) as Record<string, unknown>;

  const text = typeof o.text === "string" ? o.text.trim() : "";
  if (!text) errors.push("Question text is required.");
  else if (text.length > LIMITS.text) errors.push(`Question text is over ${LIMITS.text} characters.`);

  const opts = Array.isArray(o.options) ? o.options.map((x) => (typeof x === "string" ? x.trim() : "")) : [];
  if (opts.length !== 4) errors.push("Exactly 4 options are required.");
  opts.forEach((op, i) => {
    if (!op) errors.push(`Option ${"ABCD"[i]} is empty.`);
    else if (op.length > LIMITS.option) errors.push(`Option ${"ABCD"[i]} is over ${LIMITS.option} characters.`);
  });
  if (opts.length === 4 && new Set(opts.map((x) => x.toLowerCase())).size !== 4) errors.push("Options must be unique.");

  const correctIndex = Number(o.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) errors.push("Pick exactly one correct option.");

  let difficulty: Difficulty | null = null;
  if (o.difficulty !== null && o.difficulty !== undefined && o.difficulty !== "") {
    if ((DIFFICULTIES as readonly string[]).includes(String(o.difficulty))) difficulty = o.difficulty as Difficulty;
    else errors.push("Difficulty must be easy, medium, hard or empty (untagged).");
  }

  const category = String(o.category ?? "");
  if (!CAT_IDS.includes(category)) errors.push("Pick a valid category.");

  const explanation = typeof o.explanation === "string" ? o.explanation.trim() : "";
  if (explanation.length > LIMITS.explanation) errors.push(`Explanation is over ${LIMITS.explanation} characters.`);

  const status = (o.status ?? "active") as string;
  if (!(QUESTION_STATUSES as readonly string[]).includes(status)) errors.push("Status must be active or draft.");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      text,
      options: opts as QuestionInput["options"],
      correctIndex,
      difficulty,
      category: category as CategoryId,
      explanation,
      status: status as QuestionStatus,
    },
  };
}
