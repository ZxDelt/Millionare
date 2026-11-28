import "server-only";
import { getDb } from "./db";
import { DEFAULT_SETTINGS, type GameSettings } from "./defaults";
import { DIFFICULTIES, LADDER_LEN } from "./constants";

export type { GameSettings, LadderStep } from "./defaults";
export { DEFAULT_SETTINGS };

const KEY = "game";

export async function getSettings(): Promise<GameSettings> {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [KEY] });
  if (!r.rows.length) return DEFAULT_SETTINGS;
  const saved = JSON.parse(String(r.rows[0].value)) as Partial<GameSettings>;
  // Saved from an older ladder size (e.g. the 16-question show): its ladder and level rules no longer fit.
  if (saved.ladder?.length !== LADDER_LEN) {
    delete saved.ladder;
    delete saved.timedUntilLevel;
    delete saved.walkAwayFromLevel;
  }
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(s: GameSettings): Promise<void> {
  await setRaw(KEY, JSON.stringify(s));
}

export async function getRaw(key: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
  return r.rows.length ? String(r.rows[0].value) : null;
}

export async function setRaw(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}

const int = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export function validateSettings(raw: unknown): { ok: true; value: GameSettings } | { ok: false; errors: string[] } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const ladder = Array.isArray(o.ladder) ? o.ladder : [];
  if (ladder.length !== LADDER_LEN) errors.push(`Ladder must have exactly ${LADDER_LEN} steps.`);
  const steps = ladder.map((s, i) => {
    const st = (s ?? {}) as Record<string, unknown>;
    const coins = int(st.coins, 1, 1_000_000_000_000);
    if (coins === null) errors.push(`Q${i + 1}: coins must be a positive whole number.`);
    if (!(DIFFICULTIES as readonly string[]).includes(String(st.tier))) errors.push(`Q${i + 1}: bad tier.`);
    return { coins: coins ?? 0, tier: st.tier as GameSettings["ladder"][number]["tier"] };
  });
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].coins <= steps[i - 1].coins) { errors.push("Ladder coins must increase every step."); break; }
  }
  const field = (k: keyof GameSettings, min: number, max: number, label: string) => {
    const v = int(o[k], min, max);
    if (v === null) errors.push(`${label} must be between ${min} and ${max}.`);
    return v ?? 0;
  };
  const value: GameSettings = {
    ladder: steps,
    questionTimerSec: field("questionTimerSec", 10, 300, "Question timer"),
    timedUntilLevel: field("timedUntilLevel", 0, LADDER_LEN, "Timed until level"),
    walkAwayFromLevel: field("walkAwayFromLevel", 2, LADDER_LEN + 1, "Walk away from level"),
    phoneFriendSec: field("phoneFriendSec", 10, 300, "Phone a Friend"),
    reconfirmSec: field("reconfirmSec", 3, 60, "Reconfirm limit"),
    maxCancelsPerQuestion: field("maxCancelsPerQuestion", 0, 5, "Max cancels"),
    askAiCorrectPct: field("askAiCorrectPct", 0, 100, "Ask the AI accuracy"),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
