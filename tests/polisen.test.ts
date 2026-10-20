import { describe, expect, it } from "vitest";
import { parseEvent, parsePolisenDate, type RawEvent } from "@/lib/polisen";

const raw = (name: string, location = "Skåne län"): RawEvent => ({
  id: 1,
  datetime: "2026-10-10 8:29:23 +02:00",
  name,
  summary: "Test",
  url: "/aktuellt/handelser/2026/oktober/10/test/",
  type: "Rån",
  location: { name: location, gps: "55.99,13.59" },
});

describe("parsePolisenDate", () => {
  it("pads single-digit hours into ISO 8601", () => {
    expect(parsePolisenDate("2026-10-10 8:29:23 +02:00")).toBe("2026-10-10T08:29:23+02:00");
  });
});

describe("parseEvent", () => {
  it("takes the municipality from the end of the title", () => {
    const e = parseEvent(raw("10 oktober 08.16, Rån, Malmö"));
    expect(e).toMatchObject({ location: "Malmö", kommunkod: "1280", lanskod: "12" });
    expect(e.url).toBe("https://polisen.se/aktuellt/handelser/2026/oktober/10/test/");
  });

  it("handles types that contain commas", () => {
    expect(parseEvent(raw("10 oktober 08.16, Trafikolycka, personskada, Upplands Väsby")).kommunkod).toBe("0114");
  });

  it("keeps county-level events without a municipality", () => {
    const e = parseEvent(raw("10 oktober 06.00, Sammanfattning natt, Stockholms län", "Stockholms län"));
    expect(e).toMatchObject({ kommunkod: null, lanskod: "01" });
  });
});
