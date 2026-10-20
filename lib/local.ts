// Local information for an area (a set of DeSO codes): schools, services, nature, flood risk,
// housing and elections. All data is pre-built by the scripts in scripts/ into data/stockholm/.
import elections from "@/data/stockholm/elections.json";
import flood from "@/data/stockholm/flood.json";
import housing from "@/data/stockholm/housing.json";
import nature from "@/data/stockholm/nature.json";
import places from "@/data/stockholm/places.json";
import schools from "@/data/stockholm/schools.json";
import { ALL_DESOS } from "@/lib/stockholm";

export type School = (typeof schools.schools)[number];
export type Preschool = (typeof schools.preschools)[number];
export type Project = (typeof housing.projects)[number];
export type Bathing = (typeof nature.bathing)[number];

export const SOURCES_FETCHED = {
  schools: schools.fetched,
  places: places.fetched,
  nature: nature.fetched,
  housing: housing.fetched,
  flood: flood.fetched,
};

const inSet = (desos: string[]) => {
  const set = new Set(desos);
  return (d: string | null | undefined) => !!d && set.has(d);
};

// ---------- Schools ----------

export function schoolsIn(desos: string[]) {
  const has = inSet(desos);
  return {
    schools: schools.schools.filter((s) => has(s.deso)),
    preschools: schools.preschools.filter((p) => has(p.deso)),
  };
}

/** Pupil-weighted mean of a school statistic. */
export function weightedSchoolMean(list: School[], key: "merit9" | "certifiedTeachers" | "eligible9") {
  let w = 0;
  let sum = 0;
  for (const s of list) {
    const v = s[key];
    if (v == null) continue;
    const pupils = s.pupils ?? 1;
    w += pupils;
    sum += v * pupils;
  }
  return w ? sum / w : null;
}

export const stadSchools = () => schools.schools.filter((s) => s.kind === "grundskola");

// ---------- Services (OpenStreetMap) ----------

export const PLACE_CATEGORIES = [
  { key: "matbutik", label: "Matbutiker" },
  { key: "narbutik", label: "Närbutiker" },
  { key: "restaurang", label: "Restauranger" },
  { key: "kafe", label: "Kaféer" },
  { key: "snabbmat", label: "Snabbmat" },
  { key: "vard", label: "Vårdcentraler och kliniker" },
  { key: "sjukhus", label: "Sjukhus" },
  { key: "tandvard", label: "Tandvård" },
  { key: "apotek", label: "Apotek" },
  { key: "gym", label: "Gym" },
  { key: "lekplats", label: "Lekplatser" },
  { key: "bibliotek", label: "Bibliotek" },
] as const;

export type Place = { n: string | null; c: string; lat: number; lon: number; d: string };

export function placesIn(desos: string[]): Place[] {
  const has = inSet(desos);
  return (places.items as Place[]).filter((p) => has(p.d));
}

export function placeCounts(list: Place[]) {
  const counts: Record<string, number> = {};
  for (const p of list) counts[p.c] = (counts[p.c] ?? 0) + 1;
  return counts;
}

// ---------- Nature ----------

type NatureDeso = { landHa: number; waterShare: number; greenShare: number; protectedShare: number; protectedSites: number[] };
const NATURE = nature.deso as Record<string, NatureDeso>;

export function natureFor(desos: string[]) {
  let land = 0;
  let total = 0;
  let green = 0;
  let protectedHa = 0;
  const siteIds = new Set<number>();
  for (const d of desos) {
    const n = NATURE[d];
    if (!n) continue;
    const t = n.waterShare < 1 ? n.landHa / (1 - n.waterShare) : n.landHa;
    land += n.landHa;
    total += t;
    green += n.greenShare * n.landHa;
    protectedHa += n.protectedShare * t;
    n.protectedSites.forEach((i) => siteIds.add(i));
  }
  const has = inSet(desos);
  return {
    landHa: land,
    greenShare: land ? green / land : 0,
    waterShare: total ? (total - land) / total : 0,
    protectedShare: total ? protectedHa / total : 0,
    protectedSites: nature.protectedSites.filter((s) => siteIds.has(s.i)).sort((a, b) => b.ha - a.ha),
    bathing: nature.bathing.filter((b) => has(b.deso)),
  };
}

const toRad = (d: number) => (d * Math.PI) / 180;
export function distanceKm(a: [number, number], b: [number, number]) {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const x = toRad(lon2 - lon1) * Math.cos(toRad((lat1 + lat2) / 2));
  const y = toRad(lat2 - lat1);
  return Math.sqrt(x * x + y * y) * 6371;
}

export function nearestBathing(center: [number, number], n = 3) {
  return nature.bathing
    .map((b) => ({ ...b, km: distanceKm(center, [b.lat, b.lon]) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

// ---------- Flood risk ----------

type FloodDeso = { landHa: number; floodedHa: number; deepHa: number };
const FLOOD = flood.deso as Record<string, FloodDeso>;

export function floodFor(desos: string[]) {
  let land = 0;
  let flooded = 0;
  let deep = 0;
  for (const d of desos) {
    const f = FLOOD[d];
    if (!f) continue;
    // Land area from SCB (nature.json) is more exact than the copy stored with the flood data.
    land += NATURE[d]?.landHa ?? f.landHa;
    flooded += f.floodedHa;
    deep += f.deepHa;
  }
  return { landHa: land, floodedHa: flooded, share: land ? flooded / land : 0, deepShare: land ? deep / land : 0 };
}

export const stadFlood = () => floodFor(ALL_DESOS);

// ---------- Housing ----------

/** SCB publishes rents for three parts of Stockholm. */
const RENT_AREA: Record<string, "I" | "S" | "V"> = {
  "norra-innerstaden": "I",
  kungsholmen: "I",
  sodermalm: "I",
  "hagersten-alvsjo": "S",
  skarholmen: "S",
  "enskede-arsta-vantor": "S",
  skarpnack: "S",
  farsta: "S",
  jarva: "V",
  "hasselby-vallingby": "V",
  bromma: "V",
};
const RENT_AREA_NAME = { I: "Inre staden", S: "Söderort", V: "Västerort" };

export function housingFor(desos: string[], boroughId: string) {
  const has = inSet(desos);
  const projects = housing.projects.filter((p) => has(p.deso));
  const rentArea = RENT_AREA[boroughId];
  const regions = housing.rents.regions as Record<string, { byRooms: Record<string, number | null>; trend: { year: number; value: number | null }[] }>;
  return {
    projects,
    homesPlanned: projects.filter((p) => p.category === "Bostäder" && p.status !== "klart").reduce((s, p) => s + (p.homes ?? 0), 0),
    rent: { year: housing.rents.year, area: RENT_AREA_NAME[rentArea], local: regions[rentArea], stad: regions["0180"] },
    queue: { year: housing.queue.year, stadsdelar: housing.queue.stadsdelar.filter((q) => q.borough === boroughId) },
    prices: housing.prices,
  };
}

// ---------- Elections ----------

export type Tally = { votes: Record<string, number>; valid: number; cast: number; eligible: number };
export type ElectionKind = "riksdag" | "kommun";
export const ELECTION_YEAR = elections.year;
export const PARTIES = elections.parties;

export function electionFor(kind: ElectionKind, level: "stad" | "borough" | "regso", code?: string): Tally | null {
  const e = elections[kind] as { stockholm: Tally; borough: Record<string, Tally>; regso: Record<string, Tally> };
  if (level === "stad") {
    // Party shares use every vote in Stockholm. Turnout uses only votes tied to a voting district, as
    // for boroughs and neighbourhoods, so the comparison is like for like (late-counted votes have no district).
    const placed = Object.values(e.borough);
    return {
      ...e.stockholm,
      cast: placed.reduce((sum, t) => sum + t.cast, 0),
      eligible: placed.reduce((sum, t) => sum + t.eligible, 0),
    };
  }
  return (level === "borough" ? e.borough : e.regso)[code!] ?? null;
}
