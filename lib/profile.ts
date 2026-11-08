import { desoRegionCode, queryTable, regsoRegionCode, StatTable } from "@/lib/scb";
import {
  ALL_DESOS,
  BOROUGHS,
  desosInBorough,
  getNeighbourhood,
  NEIGHBOURHOODS,
  STOCKHOLM_KOD,
} from "@/lib/stockholm";

export type Share = { code: string; label: string; count: number; share: number };

/**
 * Statistics for one area. A value is null, and a list empty, when SCB has no data for the area, so the page
 * can say "Uppgift saknas" instead of showing 0 as if it were a fact.
 */
export type AreaStats = {
  population: number | null;
  households: number | null;
  averageAge: number | null;
  ageBands: Share[];
  ageGroups: { children: number; working: number; seniors: number };
  householdTypes: Share[];
  familiesWithChildrenShare: number | null;
  /** Only available for a single SCB region; aggregated areas use the mean. */
  medianIncome: number | null;
  meanIncome: number | null;
  incomeQuartiles: (number | null)[];
  education: Share[];
  higherEducationShare: number | null;
  houseTypes: Share[];
  tenure: Share[];
  rentalShare: number | null;
  foreignBackgroundShare: number | null;
  carsPer1000: number | null;
  employmentRate: number | null;
  buildingAge: Share[];
};

/**
 * An area to compute statistics for. `scb` lists the SCB region codes to sum; `work` lists the DeSO
 * codes used for the employment table, which SCB only publishes for DeSO/RegSO.
 */
export type AreaRef = { scb: string[]; work: string[] };

export const stadRef = (): AreaRef => ({ scb: [STOCKHOLM_KOD], work: ALL_DESOS.map(desoRegionCode) });
export const boroughRef = (id: string): AreaRef => {
  const desos = desosInBorough(id).map(desoRegionCode);
  return { scb: desos, work: desos };
};
export const neighbourhoodRef = (code: string): AreaRef => ({
  scb: [regsoRegionCode(code)],
  work: (getNeighbourhood(code)?.desos ?? []).map(desoRegionCode),
});
export const desoRef = (deso: string): AreaRef => ({ scb: [desoRegionCode(deso)], work: [desoRegionCode(deso)] });

const AGE_MIDPOINTS: Record<string, number> = {
  "-4": 2, "5-9": 7, "10-14": 12, "15-19": 17, "20-24": 22, "25-29": 27, "30-34": 32,
  "35-39": 37, "40-44": 42, "45-49": 47, "50-54": 52, "55-59": 57, "60-64": 62,
  "65-69": 67, "70-74": 72, "75-79": 77, "80-": 85,
};
const CHILD_BANDS = ["-4", "5-9", "10-14", "15-19"];
const SENIOR_BANDS = ["65-69", "70-74", "75-79", "80-"];

const HOUSEHOLD_LABELS: [string, string][] = [
  ["SBMB", "Sammanboende med barn"],
  ["SBUB", "Sammanboende utan barn"],
  ["ESMB", "Ensamstående med barn"],
  ["ESUB", "Ensamstående utan barn"],
  ["OVRIGA", "Övriga hushåll"],
];

const EDUCATION_LABELS: [string, string][] = [
  ["21", "Förgymnasial"],
  ["3+4", "Gymnasial"],
  ["5", "Eftergymnasial < 3 år"],
  ["6", "Eftergymnasial ≥ 3 år"],
];

const HOUSE_LABELS: [string, string][] = [
  ["SMÅHUS", "Småhus"],
  ["FLERBOST", "Flerbostadshus"],
  ["SPEC", "Specialbostad"],
  ["ÖVRHUS", "Övriga hus"],
];

const TENURE_LABELS: [string, string][] = [
  ["ÄG/ANDEL", "Äganderätt"],
  ["BOSTADSRÄTT", "Bostadsrätt"],
  ["HYRESRÄTT", "Hyresrätt"],
];

type Tables = Record<
  "age" | "households" | "income" | "education" | "house" | "tenure" | "background" | "cars" | "buildings" | "work",
  StatTable
>;

function sum(table: StatTable, regions: string[], codes: Record<string, string>): number | null {
  let total = 0;
  let found = false;
  for (const Region of regions) {
    const v = table.get({ Region, ...codes });
    if (v != null) {
      total += v;
      found = true;
    }
  }
  return found ? total : null;
}

/** Shares per category, or an empty list if the table has no data for the area at all. */
function shares(table: StatTable, dim: string, regions: string[], labels: [string, string][], extra = {}): Share[] {
  const raw = labels.map(([code, label]) => ({ code, label, count: sum(table, regions, { [dim]: code, ...extra }) }));
  if (raw.every((c) => c.count == null)) return [];
  const counts = raw.map((c) => ({ ...c, count: c.count ?? 0 }));
  const total = counts.reduce((s, c) => s + c.count, 0);
  return counts.map((c) => ({ ...c, share: total ? c.count / total : 0 }));
}

/** Sum of the shares of the given codes, or null when the list has no data. */
const shareOf = (list: Share[], codes: string[]) =>
  list.length ? list.filter((x) => codes.includes(x.code)).reduce((s, x) => s + x.share, 0) : null;

function statsFor(t: Tables, ref: AreaRef): AreaStats {
  const r = ref.scb;
  const rawAges = t.age
    .codes("Alder")
    .filter((c) => c !== "totalt")
    .map((code) => ({ code, label: t.age.label("Alder", code), count: sum(t.age, r, { Alder: code, Kon: "1+2" }) }));
  const ageCounts = rawAges.map((a) => ({ ...a, count: a.count ?? 0 }));
  const population = rawAges.some((a) => a.count != null) ? ageCounts.reduce((s, a) => s + a.count, 0) : null;
  const ageBands = population ? ageCounts.map((a) => ({ ...a, share: a.count / population })) : [];
  const bandShare = (pred: (code: string) => boolean) => ageBands.filter((a) => pred(a.code)).reduce((s, a) => s + a.share, 0);

  // Income: persons-weighted mean and quartile shares; the median only exists for single regions.
  // TAB6684 codes: 000008A5 = number of persons, 000008AA = mean (tkr), 000008AB = median (tkr),
  // 000008A6–A9 = % of persons in each quartile of the national distribution.
  // A region only counts towards a value when SCB has that value for it; otherwise its persons would be
  // weighted with 0 and pull the result down.
  let persons = 0;
  let meanWeighted = 0;
  let quartilePersons = 0;
  const quartiles = [0, 0, 0, 0];
  const quartileCodes = ["000008A6", "000008A7", "000008A8", "000008A9"];
  for (const Region of r) {
    const n = t.income.get({ Region, ContentsCode: "000008A5" });
    if (!n) continue;
    const mean = t.income.get({ Region, ContentsCode: "000008AA" });
    if (mean != null) {
      persons += n;
      meanWeighted += n * mean;
    }
    const q = quartileCodes.map((c) => t.income.get({ Region, ContentsCode: c }));
    if (q.every((v) => v != null)) {
      quartilePersons += n;
      q.forEach((v, i) => (quartiles[i] += (n * v!) / 100));
    }
  }

  const householdTypes = shares(t.households, "Hushallstyp", r, HOUSEHOLD_LABELS);
  const education = shares(t.education, "UtbildningsNiva", r, EDUCATION_LABELS);
  const tenure = shares(t.tenure, "Upplatelseform", r, TENURE_LABELS);
  const employed = sum(t.work, ref.work, { ContentsCode: "0000089X" });
  const workTotal = sum(t.work, ref.work, { ContentsCode: "0000089Y" });
  const cars = sum(t.cars, r, { Bestand: "ITRAF" });
  // TAB6571: "SA" = everyone, "1" = foreign background.
  const background = (code: string) => sum(t.background, r, { UtlBakgrund: code, Kon: "1+2" });
  const backgroundAll = background("SA");
  const backgroundForeign = background("1");

  const buildingCounts = t.buildings
    .codes("ByggAr")
    .filter((c) => c !== "Totalt" && c !== "Okänt")
    .map((code) => ({ code, label: t.buildings.label("ByggAr", code), count: sum(t.buildings, r, { ByggAr: code }) }));
  const buildingTotal = buildingCounts.reduce((s, b) => s + (b.count ?? 0), 0);

  return {
    population,
    households: sum(t.households, r, { Hushallstyp: "TOTALT" }),
    averageAge: population ? ageCounts.reduce((s, a) => s + a.count * (AGE_MIDPOINTS[a.code] ?? 40), 0) / population : null,
    ageBands,
    ageGroups: {
      children: bandShare((c) => CHILD_BANDS.includes(c)),
      working: bandShare((c) => !CHILD_BANDS.includes(c) && !SENIOR_BANDS.includes(c)),
      seniors: bandShare((c) => SENIOR_BANDS.includes(c)),
    },
    householdTypes,
    familiesWithChildrenShare: shareOf(householdTypes, ["SBMB", "ESMB"]),
    medianIncome: r.length === 1 ? t.income.get({ Region: r[0], ContentsCode: "000008AB" }) : null,
    meanIncome: persons ? meanWeighted / persons : null,
    incomeQuartiles: quartiles.map((q) => (quartilePersons ? q / quartilePersons : null)),
    education,
    higherEducationShare: shareOf(education, ["5", "6"]),
    houseTypes: shares(t.house, "Hustyp", r, HOUSE_LABELS),
    tenure,
    rentalShare: shareOf(tenure, ["HYRESRÄTT"]),
    foreignBackgroundShare: backgroundAll && backgroundForeign != null ? backgroundForeign / backgroundAll : null,
    carsPer1000: cars != null && population ? (cars / population) * 1000 : null,
    employmentRate: employed != null && workTotal ? employed / workTotal : null,
    buildingAge: buildingTotal
      ? buildingCounts.map((b) => ({ ...b, count: b.count ?? 0, share: (b.count ?? 0) / buildingTotal }))
      : [],
  };
}

export type StockholmData = { tables: Tables; years: Record<string, string | null> };

/**
 * Loads every statistic for all of Stockholm (569 DeSO, 127 RegSO and the city) in one request per
 * table, so any area can be computed without further calls.
 */
export async function loadStockholm(): Promise<StockholmData> {
  const desos = ALL_DESOS.map(desoRegionCode);
  const Region = [...desos, ...NEIGHBOURHOODS.map((n) => regsoRegionCode(n.code)), STOCKHOLM_KOD];
  const [age, households, income, education, house, tenure, background, cars, buildings, work] = await Promise.all([
    queryTable("TAB6574", { Region, Alder: ["*"], Kon: ["1+2"], ContentsCode: ["*"] }),
    queryTable("TAB6568", { Region, Hushallstyp: ["*"], ContentsCode: ["*"] }),
    queryTable("TAB6684", { Region, ContentsCode: ["*"] }),
    queryTable("TAB6534", { Region, UtbildningsNiva: ["*"], ContentsCode: ["*"] }),
    queryTable("TAB6065", { Region, Hustyp: ["*"], ContentsCode: ["*"] }),
    queryTable("TAB6253", { Region, Upplatelseform: ["*"], ContentsCode: ["*"] }),
    queryTable("TAB6571", { Region, UtlBakgrund: ["*"], Kon: ["1+2"], ContentsCode: ["*"] }),
    queryTable("TAB6589", { Region, Bestand: ["ITRAF"], ContentsCode: ["*"] }),
    queryTable("TAB6540", { Region, ByggAr: ["*"], ContentsCode: ["0000080B"] }),
    queryTable("TAB6680", { Region: desos, Kon: ["1+2"], Alder: ["20-64"], ContentsCode: ["0000089X", "0000089Y"] }),
  ]);
  return {
    tables: { age, households, income, education, house, tenure, background, cars, buildings, work },
    years: {
      befolkning: age.year,
      hushåll: households.year,
      inkomst: income.year,
      utbildning: education.year,
      boende: tenure.year,
      sysselsättning: work.year,
    },
  };
}

export function stats(data: StockholmData, ref: AreaRef): AreaStats {
  return statsFor(data.tables, ref);
}

export async function boroughStats() {
  const data = await loadStockholm();
  return {
    data,
    stad: stats(data, stadRef()),
    boroughs: BOROUGHS.map((b) => ({ borough: b, stats: stats(data, boroughRef(b.id)) })),
  };
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const top = (list: Share[]): Share | undefined => [...list].sort((a, b) => b.share - a.share)[0];

/** "x % högre än i Y". Returns "" when there is nothing to compare with (callers then leave out the clause). */
function compare(value: number, reference: number, refName: string, unit: "%" | "rel" = "rel") {
  // A relative difference needs a non-zero reference; a difference in percentage points does not.
  if (unit === "rel" && !reference) return "";
  const diff = unit === "%" ? (value - reference) * 100 : ((value - reference) / reference) * 100;
  if (Math.abs(diff) < 3) return `ungefär som i ${refName}`;
  const word = diff > 0 ? "högre" : "lägre";
  const amount = Math.abs(Math.round(diff));
  return unit === "%" ? `${amount} procentenheter ${word} än i ${refName}` : `${amount} % ${word} än i ${refName}`;
}

/** Plain-language summary of who lives in an area, compared with a reference area. */
/** Joins a sentence and an optional comparison clause, leaving out the clause when it is empty. */
const withComparison = (sentence: string, comparison: string) => (comparison ? `${sentence}, ${comparison}.` : `${sentence}.`);

/** Plain-language summary of who lives in an area, compared with a reference area. Missing data is left out. */
export function summarize(a: AreaStats, ref: AreaStats, refName: string): string[] {
  const lines: string[] = [];
  if (a.population == null) {
    lines.push("SCB har ingen befolkningsstatistik för området.");
  } else {
    const hh = top(a.householdTypes);
    lines.push(
      `Här bor ungefär ${a.population.toLocaleString("sv-SE")} personer` +
        (a.households != null ? ` i ${a.households.toLocaleString("sv-SE")} hushåll. ` : ". ") +
        (hh ? `Den vanligaste hushållstypen är ${hh.label.toLowerCase()} (${pct(hh.share)}).` : ""),
    );
  }
  if (a.averageAge != null && ref.averageAge != null) {
    const ageWord =
      a.averageAge < ref.averageAge - 3 ? "yngre än" : a.averageAge > ref.averageAge + 3 ? "äldre än" : "ungefär lika gamla som";
    lines.push(
      `Medelåldern är cirka ${Math.round(a.averageAge)} år – invånarna är ${ageWord} i ${refName} (${Math.round(ref.averageAge)} år). ` +
        `${pct(a.ageGroups.children)} är under 20 och ${pct(a.ageGroups.seniors)} är 65 eller äldre.`,
    );
  }
  const house = top(a.houseTypes);
  const tenure = top(a.tenure);
  if (house && tenure) {
    lines.push(`De flesta bor i ${house.label.toLowerCase()} (${pct(house.share)}), oftast med ${tenure.label.toLowerCase()} (${pct(tenure.share)}).`);
  }
  // Compare like with like: medians only when both areas have one.
  const useMedian = a.medianIncome != null && ref.medianIncome != null;
  const ai = useMedian ? a.medianIncome : a.meanIncome;
  const ri = useMedian ? ref.medianIncome : ref.meanIncome;
  if (ai != null && ri != null) {
    const what = useMedian ? "Medianen för ekonomisk standard" : "Den genomsnittliga ekonomiska standarden";
    lines.push(withComparison(`${what} är ${Math.round(ai).toLocaleString("sv-SE")} tkr per person och år`, compare(ai, ri, refName)));
  }
  if (a.higherEducationShare != null) {
    lines.push(
      withComparison(
        `${pct(a.higherEducationShare)} av de vuxna (25–65 år) har eftergymnasial utbildning`,
        ref.higherEducationShare != null ? compare(a.higherEducationShare, ref.higherEducationShare, refName, "%") : "",
      ),
    );
  }
  if (a.employmentRate != null && ref.employmentRate != null) {
    lines.push(withComparison(`${pct(a.employmentRate)} av 20–64-åringarna förvärvsarbetar`, compare(a.employmentRate, ref.employmentRate, refName, "%")));
  }
  return lines;
}
