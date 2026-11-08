import { createClient, type Client } from "@libsql/client/web";

/**
 * Production (Vercel) uses a hosted Turso database over HTTP, since serverless functions have no persistent
 * disk. Without TURSO_DATABASE_URL, a local SQLite file is used, so development works without an account.
 */
async function createDbClient(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const file = process.env.KOMMUNKOLLEN_DB ?? "data/kommunkollen.db"; // relative to the working directory
  // The file-capable client is loaded at runtime, outside the bundle: Turbopack's build fails on the dynamic
  // require libsql uses to pick its native binary. It is only reached locally, never on Vercel.
  const local = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@libsql/client");
  return local.createClient({ url: file === ":memory:" ? ":memory:" : `file:${file}` });
}

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS police_events (
    id INTEGER PRIMARY KEY,
    datetime TEXT NOT NULL,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    kommunkod TEXT,
    lanskod TEXT,
    summary TEXT NOT NULL,
    url TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_kommun ON police_events (kommunkod, datetime);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

async function connect(): Promise<Client> {
  const client = await createDbClient();
  await client.executeMultiple(SCHEMA);
  return client;
}

/** Module-level connection, shared by all requests in this process (intentional). */
let db: Promise<Client> | undefined;

export function getDb(): Promise<Client> {
  db ??= connect().catch((err) => {
    // Let the next call retry instead of caching a failed connection forever.
    db = undefined;
    throw err;
  });
  return db;
}
