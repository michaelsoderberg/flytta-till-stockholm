import { getDb } from "@/lib/db";
import { TIMEOUT_MS } from "@/lib/http";
import { findKommunByName, getKommun, LAN } from "@/lib/kommuner";

const API = "https://polisen.se/api/events";
/** The unfiltered feed covers roughly a week nationwide; a location filter returns 500 events for that place alone. */
const FEEDS = [API, `${API}?locationname=Stockholm`];
const POLL_INTERVAL_MS = 10 * 60 * 1000;

export type RawEvent = {
  id: number;
  datetime: string;
  name: string;
  summary: string;
  url: string;
  type: string;
  location: { name: string; gps: string };
};

export type PoliceEvent = {
  id: number;
  datetime: string;
  type: string;
  location: string;
  kommunkod: string | null;
  lanskod: string | null;
  summary: string;
  url: string;
};

const lanByName = new Map(Object.entries(LAN).map(([kod, namn]) => [namn.toLocaleLowerCase("sv-SE"), kod]));

/** "2026-10-10 8:29:23 +02:00" -> "2026-10-10T08:29:23+02:00" */
export function parsePolisenDate(s: string): string {
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{1,2}):(\d{2}):(\d{2}) ([+-]\d{2}:\d{2})$/);
  if (!m) return new Date(s).toISOString();
  return `${m[1]}T${m[2].padStart(2, "0")}:${m[3]}:${m[4]}${m[5]}`;
}

/**
 * The event title ends with the place, e.g. "10 oktober 08.16, Rån, Malmö".
 * The place is a municipality or, for summaries, a county ("Stockholms län").
 */
export function parseEvent(raw: RawEvent): PoliceEvent {
  const place = raw.name.split(",").at(-1)!.trim();
  const kommun = findKommunByName(place);
  const lanskod = kommun?.lanskod ?? lanByName.get(place.toLocaleLowerCase("sv-SE")) ??
    lanByName.get(raw.location.name.toLocaleLowerCase("sv-SE")) ?? null;
  return {
    id: raw.id,
    datetime: parsePolisenDate(raw.datetime),
    type: raw.type,
    location: place,
    kommunkod: kommun?.kod ?? null,
    lanskod,
    summary: raw.summary,
    url: raw.url.startsWith("http") ? raw.url : `https://polisen.se${raw.url}`,
  };
}

async function fetchFeed(url: string): Promise<RawEvent[]> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Kommunkollen (open data demo)" },
    signal: AbortSignal.timeout(TIMEOUT_MS.polisen),
  });
  if (!res.ok) throw new Error(`Polisen API ${res.status}`);
  return (await res.json()) as RawEvent[];
}

export async function collectEvents(): Promise<{ fetched: number; inserted: number }> {
  const raw: RawEvent[] = [];
  for (const url of FEEDS) raw.push(...(await fetchFeed(url)));
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO police_events (id, datetime, type, location, kommunkod, lanskod, summary, url)
    VALUES (@id, @datetime, @type, @location, @kommunkod, @lanskod, @summary, @url)
    ON CONFLICT(id) DO UPDATE SET summary = excluded.summary, type = excluded.type
  `);
  let inserted = 0;
  db.transaction(() => {
    for (const r of raw) {
      const before = db.prepare("SELECT 1 FROM police_events WHERE id = ?").get(r.id);
      insert.run(parseEvent(r));
      if (!before) inserted++;
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('polisen_last_poll', ?)").run(new Date().toISOString());
  })();
  return { fetched: raw.length, inserted };
}

/**
 * Time of the last collection attempt, successful or not. Kept in memory so that while Polisen's API is
 * down, it is retried at most once per poll interval instead of on every page view.
 */
let lastAttempt = 0;

/** Collects if the last poll is older than the poll interval. Errors are logged, never thrown. */
export async function collectIfStale() {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = 'polisen_last_poll'").get() as
    | { value: string }
    | undefined;
  if (row && Date.now() - Date.parse(row.value) < POLL_INTERVAL_MS) return;
  if (Date.now() - lastAttempt < POLL_INTERVAL_MS) return;
  lastAttempt = Date.now();
  try {
    await collectEvents();
  } catch (err) {
    console.error("Polisen collection failed", err);
  }
}

/**
 * Events in the municipality, plus county-level events (e.g. "Sammanfattning natt") whose text mentions it.
 */
export function getEventsForKommun(kommunkod: string, days: number): PoliceEvent[] {
  const kommun = getKommun(kommunkod);
  if (!kommun) return [];
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  // datetime is stored with its original offset; compare on the UTC instant.
  return getDb()
    .prepare(
      `SELECT * FROM police_events
       WHERE (kommunkod = @kod OR (kommunkod IS NULL AND lanskod = @lan AND instr(summary, @namn) > 0))
         AND datetime(datetime) >= datetime(@since)
       ORDER BY datetime(datetime) DESC`,
    )
    .all({ kod: kommunkod, lan: kommun.lanskod, namn: kommun.namn, since }) as PoliceEvent[];
}

export function getCollectionStart(): string | null {
  const row = getDb().prepare("SELECT MIN(datetime(datetime)) AS first FROM police_events").get() as {
    first: string | null;
  };
  return row.first;
}

export function getStockholmEvents(days: number): PoliceEvent[] {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  return getDb()
    .prepare(
      `SELECT * FROM police_events WHERE kommunkod = '0180' AND datetime(datetime) >= datetime(?) ORDER BY datetime(datetime) DESC`,
    )
    .all(since) as PoliceEvent[];
}

export function getStockholmCollectionStart(): string | null {
  const row = getDb().prepare("SELECT MIN(datetime(datetime)) AS first FROM police_events WHERE kommunkod = '0180'").get() as {
    first: string | null;
  };
  return row.first;
}
