/**
 * Copies the locally collected police events into the Turso database used in production.
 * Existing rows in Turso are never overwritten (INSERT OR IGNORE), so it is safe to run more than once.
 *
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run migrate-police
 */
import { createClient } from "@libsql/client";
import path from "node:path";
import { SCHEMA } from "../lib/db";

const BATCH = 500;

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url?.startsWith("libsql://")) throw new Error("Set TURSO_DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN");
  const localFile = process.env.KOMMUNKOLLEN_DB ?? path.join(process.cwd(), "data", "kommunkollen.db");
  const local = createClient({ url: `file:${localFile}` });
  const remote = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await remote.executeMultiple(SCHEMA);

  const { rows } = await local.execute("SELECT * FROM police_events ORDER BY id");
  console.log(`${rows.length} events in ${localFile}`);
  for (let i = 0; i < rows.length; i += BATCH) {
    await remote.batch(
      rows.slice(i, i + BATCH).map((r) => ({
        sql: `INSERT OR IGNORE INTO police_events (id, datetime, type, location, kommunkod, lanskod, summary, url)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [r.id, r.datetime, r.type, r.location, r.kommunkod, r.lanskod, r.summary, r.url],
      })),
      "write",
    );
  }
  const count = (await remote.execute("SELECT COUNT(*) AS n FROM police_events")).rows[0].n;
  console.log(`Turso now has ${count} events`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
