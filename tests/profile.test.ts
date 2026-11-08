import { describe, expect, it } from "vitest";
import { stats, summarize, type StockholmData } from "@/lib/profile";
import type { StatTable } from "@/lib/scb";

/** A stand-in for an SCB table: values keyed by "Region|dim=code|…" in the order the code asks. */
function table(values: Record<string, number>, dims: Record<string, string[]> = {}): StatTable {
  return {
    get: (codes: Record<string, string>) => {
      const { Region, ...rest } = codes;
      const key = [Region, ...Object.entries(rest).sort().map(([k, v]) => `${k}=${v}`)].join("|");
      return values[key] ?? null;
    },
    codes: (dim: string) => dims[dim] ?? [],
    label: (_dim: string, code: string) => code,
    year: "2025",
  } as unknown as StatTable;
}

const empty = table({});
function data(tables: Partial<StockholmData["tables"]>): StockholmData {
  const all = { age: empty, households: empty, income: empty, education: empty, house: empty, tenure: empty,
    background: empty, cars: empty, buildings: empty, work: empty, ...tables };
  return { tables: all as StockholmData["tables"], years: {} };
}
const ref = { scb: ["A", "B"], work: [] };

describe("area statistics", () => {
  it("returns null, not 0, when SCB has no data for the area", () => {
    const s = stats(data({}), ref);
    expect(s.population).toBeNull();
    expect(s.households).toBeNull();
    expect(s.averageAge).toBeNull();
    expect(s.rentalShare).toBeNull();
    expect(s.higherEducationShare).toBeNull();
    expect(s.foreignBackgroundShare).toBeNull();
    expect(s.tenure).toEqual([]);
    expect(s.incomeQuartiles).toEqual([null, null, null, null]);
  });

  it("leaves a region without a mean out of the mean income instead of counting it as 0", () => {
    const income = table({
      "A|ContentsCode=000008A5": 100, "A|ContentsCode=000008AA": 300,
      "B|ContentsCode=000008A5": 100, // persons but no mean
    });
    expect(stats(data({ income }), ref).meanIncome).toBe(300);
  });

  it("writes no empty comparison or missing numbers in the summary", () => {
    const lines = summarize(stats(data({}), ref), stats(data({}), ref), "Stockholm");
    expect(lines).toEqual(["SCB har ingen befolkningsstatistik för området."]);
    expect(lines.join(" ")).not.toMatch(/, \.|null|undefined|NaN/);
  });
});
