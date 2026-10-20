import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as cron } from "@/app/api/cron/polisen/route";
import { GET as floodMap } from "@/app/api/flood-map/route";
import { optional } from "@/lib/http";

const TILE =
  "service=WMS&request=GetMap&version=1.1.1&layers=57&styles=&format=image%2Fpng&transparent=true" +
  "&width=256&height=256&srs=EPSG%3A3857&bbox=1995923.6,8257187.4,2005707.5,8266971.4";

describe("cron route", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses every request when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await cron(new NextRequest("http://localhost/api/cron/polisen"));
    expect(res.status).toBe(503);
  });

  it("refuses a wrong or missing key", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const wrong = new NextRequest("http://localhost/api/cron/polisen", { headers: { authorization: "Bearer nope" } });
    expect((await cron(wrong)).status).toBe(401);
    expect((await cron(new NextRequest("http://localhost/api/cron/polisen"))).status).toBe(401);
  });
});

describe("flood map proxy", () => {
  const get = (query: string) => floodMap(new NextRequest(`http://localhost/api/flood-map?${query}`));

  it("rejects layers other than the two the app uses", async () => {
    expect((await get(TILE.replace("layers=57", "layers=1"))).status).toBe(400);
  });

  it("rejects tiles outside Stockholm, oversized tiles and other projections", async () => {
    expect((await get(TILE.replace(/bbox=[^&]+/, "bbox=1500000,7000000,1510000,7010000"))).status).toBe(400);
    expect((await get(TILE.replace(/bbox=[^&]+/, "bbox=1800000,8100000,2200000,8500000"))).status).toBe(400);
    expect((await get(TILE.replace("EPSG%3A3857", "EPSG%3A4326"))).status).toBe(400);
    expect((await get(TILE.replace("width=256", "width=5000"))).status).toBe(400);
  });
});

describe("optional", () => {
  it("returns null instead of throwing when a source fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(optional(Promise.reject(new Error("SCB down")), "test")).resolves.toBeNull();
    await expect(optional(Promise.resolve(42), "test")).resolves.toBe(42);
  });
});
