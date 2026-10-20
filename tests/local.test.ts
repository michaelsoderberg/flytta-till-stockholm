import { describe, expect, it } from "vitest";
import { electionFor, floodFor, housingFor, natureFor, PARTIES, schoolsIn } from "@/lib/local";
import { ALL_DESOS, BOROUGHS, desosInBorough } from "@/lib/stockholm";

describe("local data", () => {
  it("party shares add up to all valid votes", () => {
    for (const kind of ["riksdag", "kommun"] as const) {
      const t = electionFor(kind, "stad")!;
      const sum = PARTIES.reduce((s, p) => s + t.votes[p.key], 0);
      expect(Math.abs(sum - t.valid) / t.valid).toBeLessThan(0.001);
    }
  });

  it("splits votes across boroughs without losing any placed votes", () => {
    const stad = electionFor("riksdag", "stad")!;
    const boroughs = BOROUGHS.map((b) => electionFor("riksdag", "borough", b.id)!);
    const cast = boroughs.reduce((s, t) => s + t.cast, 0);
    expect(cast).toBe(stad.cast);
    expect(stad.cast / stad.eligible).toBeGreaterThan(0.75);
  });

  it("places every school and preschool in a borough", () => {
    const { schools, preschools } = schoolsIn(ALL_DESOS);
    expect(schools.length).toBeGreaterThan(300);
    expect(preschools.length).toBeGreaterThan(800);
    const perBorough = BOROUGHS.map((b) => schoolsIn(desosInBorough(b.id)).schools.length);
    expect(perBorough.reduce((s, n) => s + n, 0)).toBe(schools.length);
  });

  it("has plausible shares for nature and flood risk", () => {
    const n = natureFor(ALL_DESOS);
    expect(n.landHa).toBeGreaterThan(18_000); // Stockholm has about 188 km² of land
    expect(n.waterShare).toBeGreaterThan(0.05);
    const f = floodFor(ALL_DESOS);
    expect(f.share).toBeGreaterThan(0);
    expect(f.share).toBeLessThan(0.5);
  });

  it("gives every borough a rent area and queue statistics", () => {
    for (const b of BOROUGHS) {
      const h = housingFor(desosInBorough(b.id), b.id);
      expect(h.rent.local?.byRooms["00"]).toBeGreaterThan(5000);
      expect(h.queue.stadsdelar.length).toBeGreaterThan(0);
    }
  });
});
