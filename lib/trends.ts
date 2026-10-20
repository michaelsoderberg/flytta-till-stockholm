import areas from "@/data/stockholm/areas.json";
import { desoRegionCode, queryTable, StatTable } from "@/lib/scb";
import { ALL_DESOS, desosInBorough, getNeighbourhood, STOCKHOLM_KOD } from "@/lib/stockholm";

const FROM_YEAR = "2015";
const DESO_2018 = areas.deso2018 as Record<string, { borough: string; regso: string | null }>;
const OLD_CODES = Object.keys(DESO_2018).sort();

/**
 * SCB publishes years up to 2023 for the 2018 DeSO division and later years for the 2025 division.
 * A trend area lists its codes in both; each year uses whichever division has data.
 */
export type TrendRef = { old: string[]; new: string[] };

export const stadTrendRef = (): TrendRef => ({ old: [STOCKHOLM_KOD], new: [STOCKHOLM_KOD] });
export const boroughTrendRef = (id: string): TrendRef => ({
  old: OLD_CODES.filter((c) => DESO_2018[c].borough === id),
  new: desosInBorough(id).map(desoRegionCode),
});
export const neighbourhoodTrendRef = (code: string): TrendRef => ({
  old: OLD_CODES.filter((c) => DESO_2018[c].regso === code),
  new: (getNeighbourhood(code)?.desos ?? []).map(desoRegionCode),
});

export type TrendPoint = {
  year: number;
  population: number | null;
  meanIncome: number | null;
  rentalShare: number | null;
  childrenShare: number | null;
};

type TrendTables = { age: StatTable; income: StatTable; tenure: StatTable };

let loading: Promise<TrendTables> | undefined;

export function loadTrends(): Promise<TrendTables> {
  const Region = [...OLD_CODES, ...ALL_DESOS.map(desoRegionCode), STOCKHOLM_KOD];
  const Tid = [`from(${FROM_YEAR})`];
  loading ??= Promise.all([
    queryTable("TAB6574", { Region, Alder: ["totalt", "-4", "5-9", "10-14", "15-19"], Kon: ["1+2"], ContentsCode: ["*"], Tid }),
    queryTable("TAB6684", { Region, ContentsCode: ["000008AA", "000008A5"], Tid }),
    queryTable("TAB6253", { Region, Upplatelseform: ["HYRESRÄTT", "TOTALT"], ContentsCode: ["*"], Tid }),
  ]).then(([age, income, tenure]) => ({ age, income, tenure }));
  loading.catch(() => (loading = undefined));
  return loading;
}

function sumCodes(t: StatTable, codes: string[], sel: Record<string, string>) {
  let total = 0;
  let found = false;
  for (const Region of codes) {
    const v = t.get({ Region, ...sel });
    if (v) {
      total += v;
      found = true;
    }
  }
  return found ? total : null;
}

/** Sums over the new division when it has data for the year, otherwise over the old one. */
function pick(t: StatTable, ref: TrendRef, sel: Record<string, string>) {
  return sumCodes(t, ref.new, sel) ?? sumCodes(t, ref.old, sel);
}

function weightedMean(t: StatTable, ref: TrendRef, year: string) {
  for (const codes of [ref.new, ref.old]) {
    let persons = 0;
    let weighted = 0;
    for (const Region of codes) {
      const n = t.get({ Region, ContentsCode: "000008A5", Tid: year }) ?? 0;
      const mean = t.get({ Region, ContentsCode: "000008AA", Tid: year });
      if (n && mean != null) {
        persons += n;
        weighted += n * mean;
      }
    }
    if (persons) return weighted / persons;
  }
  return null;
}

export function trendFor(t: TrendTables, ref: TrendRef): TrendPoint[] {
  return t.age.codes("Tid").map((Tid) => {
    const population = pick(t.age, ref, { Alder: "totalt", Kon: "1+2", Tid });
    const children = ["-4", "5-9", "10-14", "15-19"].reduce((s, Alder) => s + (pick(t.age, ref, { Alder, Kon: "1+2", Tid }) ?? 0), 0);
    const rental = pick(t.tenure, ref, { Upplatelseform: "HYRESRÄTT", Tid });
    const tenureTotal = pick(t.tenure, ref, { Upplatelseform: "TOTALT", Tid });
    const incomeYears = t.income.codes("Tid");
    return {
      year: Number(Tid),
      population,
      meanIncome: incomeYears.includes(Tid) ? weightedMean(t.income, ref, Tid) : null,
      rentalShare: rental != null && tenureTotal ? rental / tenureTotal : null,
      childrenShare: population ? children / population : null,
    };
  });
}
