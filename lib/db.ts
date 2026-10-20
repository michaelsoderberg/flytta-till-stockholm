import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DB_PATH = process.env.KOMMUNKOLLEN_DB ?? path.join(process.cwd(), "data", "kommunkollen.db");

let db: Database.Database | undefined;

export function getDb() {
  if (db) return db;
  if (DB_PATH !== ":memory:") mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
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
  `);
  return db;
}
