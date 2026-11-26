import "server-only";
import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SCHEMA } from "./schema";

/**
 * One libSQL client per server instance.
 * Local dev: TURSO_DATABASE_URL=file:./data/joule.db (plain SQLite file).
 * Vercel: TURSO_DATABASE_URL=libsql://... + TURSO_AUTH_TOKEN (Turso). The local disk is not persistent there.
 */
const g = globalThis as unknown as { __jjDb?: Client; __jjSchema?: Promise<void> };

function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL || "file:./data/joule.db";
  if (url.startsWith("file:")) {
    if (process.env.VERCEL) {
      throw new Error("TURSO_DATABASE_URL points to a local file; Vercel has no persistent disk. Use a Turso URL.");
    }
    mkdirSync(dirname(resolve(url.slice("file:".length))), { recursive: true });
  }
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN || undefined });
}

export async function getDb(): Promise<Client> {
  g.__jjDb ??= makeClient();
  g.__jjSchema ??= g.__jjDb.batch(SCHEMA, "write").then(() => undefined);
  await g.__jjSchema;
  return g.__jjDb;
}
