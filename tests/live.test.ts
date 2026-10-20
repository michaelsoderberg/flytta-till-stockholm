// Calls the real APIs. Run with: LIVE=1 npm test
import { describe, expect, it } from "vitest";
import { desoAtPoint } from "@/lib/deso";
import { boroughStats } from "@/lib/profile";

describe.runIf(process.env.LIVE)("live APIs", () => {
  it("finds the DeSO for Medborgarplatsen, Södermalm", async () => {
    const f = await desoAtPoint(59.3143, 18.0735);
    expect(f?.kommunkod).toBe("0180");
  });

  it("aggregates borough populations to roughly the city total", async () => {
    const { stad, boroughs } = await boroughStats();
    const sum = boroughs.reduce((s, b) => s + b.stats.population, 0);
    expect(Math.abs(sum - stad.population) / stad.population).toBeLessThan(0.005);
  });
}, 60_000);
