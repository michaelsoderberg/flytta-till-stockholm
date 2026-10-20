import { describe, expect, it } from "vitest";
import { verdict } from "@/lib/compare";
import { findKommunByName } from "@/lib/kommuner";

describe("verdict", () => {
  it("respects the direction of the indicator", () => {
    expect(verdict(110, 100, true)).toBe("better");
    expect(verdict(110, 100, false)).toBe("worse");
    expect(verdict(101, 100, true)).toBe("similar");
    expect(verdict(110, 100, null)).toBe("neutral");
  });
});

describe("findKommunByName", () => {
  it("accepts suffixes and case differences", () => {
    expect(findKommunByName("göteborg")?.kod).toBe("1480");
    expect(findKommunByName("Uppsala kommun")?.kod).toBe("0380");
    expect(findKommunByName("Atlantis")).toBeUndefined();
  });
});
