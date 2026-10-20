import data from "@/data/kommuner.json";

export type Kommun = { kod: string; namn: string; lanskod: string; lan: string };

export const KOMMUNER: Kommun[] = data.kommuner;
export const LAN: Record<string, string> = data.lan;

const byKod = new Map(KOMMUNER.map((k) => [k.kod, k]));
const byName = new Map(KOMMUNER.map((k) => [normalize(k.namn), k]));

function normalize(s: string) {
  return s.trim().toLocaleLowerCase("sv-SE");
}

export function getKommun(kod: string): Kommun | undefined {
  return byKod.get(kod);
}

/** Matches a municipality by exact name, also accepting "X kommun" and "X stad". */
export function findKommunByName(name: string): Kommun | undefined {
  const n = normalize(name).replace(/\s+(kommun|stad)$/, "");
  return byName.get(n);
}

export function searchKommuner(query: string, limit = 8): Kommun[] {
  const q = normalize(query);
  if (!q) return [];
  const starts = KOMMUNER.filter((k) => normalize(k.namn).startsWith(q));
  const contains = KOMMUNER.filter((k) => !normalize(k.namn).startsWith(q) && normalize(k.namn).includes(q));
  return [...starts, ...contains].slice(0, limit);
}

/** Kolada id for the county region, e.g. "03" -> "0003". */
export function regionId(lanskod: string) {
  return `00${lanskod}`;
}
