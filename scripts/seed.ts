/**
 * Seeds the DB: schema, default settings (if missing) and sample questions (if the table is empty).
 * Run: npm run db:seed   (uses TURSO_DATABASE_URL from .env.local; works for local file or Turso)
 */
import { createClient } from "@libsql/client";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { SCHEMA } from "../src/lib/schema";
import { DEFAULT_SETTINGS } from "../src/lib/defaults";
import { SAMPLE_QUESTIONS } from "./sample-questions";

async function main() {
  const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL || "file:./data/joule.db";
  if (url.startsWith("file:")) mkdirSync(dirname(resolve(url.slice(5))), { recursive: true });
  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN || undefined });

  await db.batch(SCHEMA, "write");

  await db.execute({
    sql: "INSERT INTO settings (key, value) VALUES ('game', ?) ON CONFLICT(key) DO NOTHING",
    args: [JSON.stringify(DEFAULT_SETTINGS)],
  });

  // Insert any starter question whose text isn't in the DB yet (idempotent; never touches admin edits).
  const bank = JSON.parse(readFileSync(join(__dirname, "question-bank.json"), "utf8")) as typeof SAMPLE_QUESTIONS;
  const all = [...SAMPLE_QUESTIONS, ...bank];
  const { rows } = await db.execute("SELECT text FROM questions");
  const have = new Set(rows.map((r) => String(r.text).trim().toLowerCase()));
  const missing = all.filter((q) => !have.has(q.text.trim().toLowerCase()));
  if (missing.length) {
    await db.batch(
      missing.map((q) => ({
        sql: `INSERT INTO questions (text, options, correct_index, difficulty, category, explanation, status)
              VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        args: [q.text, JSON.stringify(q.options), q.correctIndex, q.difficulty, q.category, q.explanation],
      })),
      "write",
    );
  }
  console.log(`Inserted ${missing.length} questions (${all.length} in starter set, ${rows.length} already in DB).`);
  console.log(`Seed done → ${url.startsWith("file:") ? url : "Turso"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
