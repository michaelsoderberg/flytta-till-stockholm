import { describe, expect, it } from "vitest";
import { StatTable, type JsonStat2 } from "@/lib/scb";

const data: JsonStat2 = {
  id: ["Region", "Alder", "Tid"],
  size: [2, 3, 1],
  value: [1, 2, 3, 10, 20, 30],
  dimension: {
    Region: { category: { index: { A: 0, B: 1 }, label: { A: "A", B: "B" } } },
    Alder: { category: { index: { x: 0, y: 1, z: 2 }, label: { x: "x", y: "y", z: "z" } } },
    Tid: { category: { index: { "2025": 0 }, label: { "2025": "2025" } } },
  },
};

describe("StatTable", () => {
  const t = new StatTable(data);

  it("reads values in row-major order and fills single-value dimensions", () => {
    expect(t.get({ Region: "A", Alder: "x" })).toBe(1);
    expect(t.get({ Region: "B", Alder: "z" })).toBe(30);
  });

  it("returns null for unknown codes", () => {
    expect(t.get({ Region: "C", Alder: "x" })).toBeNull();
  });

  it("exposes codes and year", () => {
    expect(t.codes("Alder")).toEqual(["x", "y", "z"]);
    expect(t.year).toBe("2025");
  });
});
