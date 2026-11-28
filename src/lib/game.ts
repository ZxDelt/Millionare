import "server-only";
import { randomBytes } from "node:crypto";
import { getDb } from "./db";
import { getSettings } from "./settings";
import { apply, GameError, newSession, tick, toPublic, type QuestionSnap, type SessionState } from "./game-engine";
import type { GameAction, PublicState } from "./game-types";
import type { Difficulty } from "./constants";
import { pickCpclFact } from "./cpcl-facts";

/** Tier fallback order (GDD §6): tagged tier → untagged → nearest other tiers. */
const FALLBACK: Record<Difficulty, Difficulty[]> = {
  easy: ["medium", "hard"],
  medium: ["easy", "hard"],
  hard: ["medium", "easy"],
};

async function pickQuestion(tier: Difficulty, exclude: number[], factsUsed: string[]): Promise<QuestionSnap> {
  const db = await getDb();
  const ex = exclude.length ? `AND id NOT IN (${exclude.map(() => "?").join(",")})` : "";
  const order = "ORDER BY times_used ASC, RANDOM() LIMIT 1"; // least-used first, random among equals
  const tries: { where: string; args: (string | number)[] }[] = [
    { where: "difficulty = ?", args: [tier] },
    { where: "difficulty IS NULL", args: [] },
    ...FALLBACK[tier].map((t) => ({ where: "difficulty = ?", args: [t] as (string | number)[] })),
  ];
  for (const t of tries) {
    const r = await db.execute({
      sql: `SELECT id, text, options, correct_index, explanation, category FROM questions
            WHERE status = 'active' AND ${t.where} ${ex} ${order}`,
      args: [...t.args, ...exclude],
    });
    if (r.rows.length) {
      const row = r.rows[0];
      await db.execute({
        sql: "UPDATE questions SET times_used = times_used + 1, last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        args: [Number(row.id)],
      });
      return {
        id: Number(row.id),
        text: String(row.text),
        options: JSON.parse(String(row.options)),
        correctIndex: Number(row.correct_index),
        explanation: String(row.explanation ?? ""),
        cpclFact: pickCpclFact(row.category == null ? null : String(row.category), factsUsed),
      };
    }
  }
  throw new GameError("The question bank ran out of questions.", 500);
}

async function load(id: string): Promise<SessionState> {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new GameError("Game not found.", 404);
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT state FROM sessions WHERE id = ?", args: [id] });
  if (!r.rows.length) throw new GameError("Game not found.", 404);
  return JSON.parse(String(r.rows[0].state)) as SessionState;
}

/** Optimistic concurrency: a double-click can't apply the same action twice. */
async function store(s: SessionState, prevVersion: number | null): Promise<void> {
  const db = await getDb();
  if (prevVersion === null) {
    await db.execute({ sql: "INSERT INTO sessions (id, state) VALUES (?, ?)", args: [s.id, JSON.stringify(s)] });
    return;
  }
  const r = await db.execute({
    sql: `UPDATE sessions SET state = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ? AND json_extract(state, '$.version') = ?`,
    args: [JSON.stringify(s), s.id, prevVersion],
  });
  if (r.rowsAffected === 0) throw new GameError("The game changed in another tab. Refreshing.", 409);
}

export async function startGame(rawName: string): Promise<PublicState> {
  const name = rawName.replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 20);
  if (!name) throw new GameError("Please enter your name.", 400);
  const settings = await getSettings();
  const db = await getDb();

  const { rows } = await db.execute("SELECT COUNT(*) AS n FROM questions WHERE status = 'active'");
  if (Number(rows[0].n) < settings.ladder.length) throw new GameError("Question bank too small. Ask the admin to add questions.", 503);

  // Housekeeping: drop sessions idle for 2+ days.
  await db.execute("DELETE FROM sessions WHERE updated_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')");
  await db.execute("DELETE FROM tts_usage WHERE session_id NOT IN (SELECT id FROM sessions)");

  const now = Date.now();
  const q = await pickQuestion(settings.ladder[0].tier, [], []);
  const s = newSession(randomBytes(16).toString("hex"), name, settings, q, now);
  s.factsUsed = q.cpclFact ? [q.cpclFact] : [];
  await store(s, null);
  return toPublic(s, now);
}

export async function getGame(id: string): Promise<PublicState> {
  const s = await load(id);
  const now = Date.now();
  const before = s.phase;
  tick(s, now);
  if (s.phase !== before) {
    const prev = s.version;
    s.version += 1;
    await store(s, prev);
  }
  return toPublic(s, now);
}

export async function act(id: string, action: GameAction): Promise<PublicState> {
  const s = await load(id);
  const prev = s.version;
  const now = Date.now();
  let nextQ: QuestionSnap | undefined;
  if (action.type === "next" && s.phase === "revealed") {
    nextQ = await pickQuestion(s.settings.ladder[s.level].tier, s.usedIds, s.factsUsed ?? []);
  }
  apply(s, action, now, { nextQ });
  if (nextQ?.cpclFact) s.factsUsed = [...(s.factsUsed ?? []), nextQ.cpclFact];
  await store(s, prev);
  return toPublic(s, now);
}

/** Voice abuse cap: a game may request at most this many TTS clips. */
export const MAX_TTS_PER_GAME = 150;

export async function chargeTts(id: string): Promise<boolean> {
  await load(id); // must be a real game
  const db = await getDb();
  const r = await db.execute({
    sql: `INSERT INTO tts_usage (session_id, n) VALUES (?, 1)
          ON CONFLICT(session_id) DO UPDATE SET n = n + 1 RETURNING n`,
    args: [id],
  });
  return Number(r.rows[0].n) <= MAX_TTS_PER_GAME;
}
