/** Idempotent schema. Runs once per server instance on first DB access. */
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS questions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    text          TEXT    NOT NULL,
    options       TEXT    NOT NULL,                 -- JSON array of 4 strings
    correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
    difficulty    TEXT    CHECK (difficulty IN ('easy','medium','hard')), -- NULL = untagged
    category      TEXT    NOT NULL,
    explanation   TEXT    NOT NULL DEFAULT '',
    status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft')),
    times_used    INTEGER NOT NULL DEFAULT 0,
    last_used_at  TEXT,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_questions_pick ON questions (status, difficulty, last_used_at)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL                              -- JSON
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    state      TEXT NOT NULL,                        -- JSON game state
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions (updated_at)`,
  `CREATE TABLE IF NOT EXISTS tts_usage (
    session_id TEXT PRIMARY KEY,
    n          INTEGER NOT NULL DEFAULT 0            -- voice clips requested by this game session (abuse cap)
  )`,
  `CREATE TABLE IF NOT EXISTS host_lines (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    state TEXT NOT NULL,                             -- host state machine state, e.g. 'intro'
    text  TEXT NOT NULL
  )`,
];
