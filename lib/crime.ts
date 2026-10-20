import crime from "@/data/stockholm/crime.json";

export type CrimeCell = { count: number; per100k: number };
export type CrimeCategory = { key: string; label: string };

export const CRIME_SOURCE = crime.source;
export const CRIME_FETCHED = crime.fetched;
export const CRIME_YEARS: number[] = crime.years;
export const CRIME_CATEGORIES: CrimeCategory[] = crime.categories;
export const LATEST_CRIME_YEAR = Math.max(...CRIME_YEARS);

type Series = Record<string, Record<string, CrimeCell>>;
const REGIONS = crime.regions as Record<string, Series>;

/** Reported crimes for a borough id or "stockholm", per category and year. */
export function crimeFor(region: string, category: string, year = LATEST_CRIME_YEAR): CrimeCell | null {
  return REGIONS[region]?.[category]?.[String(year)] ?? null;
}

export function crimeTrend(region: string, category: string) {
  return CRIME_YEARS.map((year) => ({ year, value: crimeFor(region, category, year)?.per100k ?? null }));
}
