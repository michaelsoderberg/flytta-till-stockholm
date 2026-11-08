import { describe, expect, it } from "vitest";
import { assertAtLeast, assertComparable, assertOk } from "@/scripts/lib/checks";

describe("build script checks", () => {
  it("refuses a result below the minimum", () => {
    expect(() => assertAtLeast("places", 0, 1)).toThrow(/got 0, expected at least 1.*not overwritten/);
    expect(() => assertAtLeast("places", Number.NaN, 1)).toThrow();
    expect(() => assertAtLeast("places", 5, 1)).not.toThrow();
  });

  it("refuses a large drop compared with the previous build", () => {
    expect(() => assertComparable("places", 500, 1000)).toThrow(/previous build had 1000/);
    expect(() => assertComparable("places", 950, 1000)).not.toThrow();
    expect(() => assertComparable("flood", 600, 1000, 0.5)).not.toThrow();
  });

  it("skips the comparison on a first build", () => {
    expect(() => assertComparable("places", 1, null)).not.toThrow();
    expect(() => assertComparable("places", 1, undefined)).not.toThrow();
  });

  it("names the URL when a response is not OK", async () => {
    const res = new Response("Service Unavailable", { status: 503 });
    Object.defineProperty(res, "url", { value: "https://example.org/data" });
    await expect(assertOk(res, "HaV")).rejects.toThrow(/HaV: HTTP 503 from https:\/\/example.org\/data – Service Unavailable/);
    await expect(assertOk(new Response("ok"), "HaV")).resolves.toBeUndefined();
  });
});
