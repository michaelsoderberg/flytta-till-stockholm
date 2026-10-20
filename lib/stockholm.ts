import areas from "@/data/stockholm/areas.json";

export const STOCKHOLM_KOD = "0180";

export type Borough = { id: string; name: string; stadsdelar: string[] };
export type Neighbourhood = { code: string; name: string; borough: string; desos: string[] };

export const BOROUGHS: Borough[] = areas.boroughs;
const DESO_BOROUGH: Record<string, string> = areas.deso;
export const NEIGHBOURHOODS: Neighbourhood[] = Object.entries(areas.regso)
  .map(([code, r]) => ({ code, ...r }))
  .sort((a, b) => a.name.localeCompare(b.name, "sv"));

const boroughById = new Map(BOROUGHS.map((b) => [b.id, b]));
const neighbourhoodByCode = new Map(NEIGHBOURHOODS.map((n) => [n.code, n]));
const neighbourhoodOfDeso = new Map(NEIGHBOURHOODS.flatMap((n) => n.desos.map((d) => [d, n] as const)));

export const ALL_DESOS = Object.keys(DESO_BOROUGH).sort();

export function getBorough(id: string) {
  return boroughById.get(id);
}

export function getNeighbourhood(code: string) {
  return neighbourhoodByCode.get(code);
}

export function neighbourhoodForDeso(deso: string) {
  return neighbourhoodOfDeso.get(deso);
}

export function boroughForDeso(deso: string) {
  const id = DESO_BOROUGH[deso];
  return id ? boroughById.get(id) : undefined;
}

export function desosInBorough(id: string) {
  return ALL_DESOS.filter((d) => DESO_BOROUGH[d] === id);
}

export function neighbourhoodsInBorough(id: string) {
  return NEIGHBOURHOODS.filter((n) => n.borough === id);
}

/** "BROMMA KYRKA" -> "Bromma kyrka" */
export function titleCase(name: string) {
  const lower = name.toLocaleLowerCase("sv-SE");
  return lower.charAt(0).toLocaleUpperCase("sv-SE") + lower.slice(1);
}

export const isNeighbourhoodCode = (code: string) => /^0180R\d{3}$/.test(code);
export const isDesoCode = (code: string) => /^0180[A-C]\d{4}$/.test(code);
