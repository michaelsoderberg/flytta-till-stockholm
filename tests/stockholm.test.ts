import { describe, expect, it } from "vitest";
import { crimeFor, CRIME_CATEGORIES } from "@/lib/crime";
import { placeEvent } from "@/lib/police-areas";
import type { PoliceEvent } from "@/lib/polisen";
import { ALL_DESOS, BOROUGHS, boroughForDeso, NEIGHBOURHOODS } from "@/lib/stockholm";

const event = (summary: string): PoliceEvent => ({
  id: 1,
  datetime: "2026-10-10T08:00:00+02:00",
  type: "Stöld",
  location: "Stockholm",
  kommunkod: "0180",
  lanskod: "01",
  summary,
  url: "https://polisen.se/",
});

describe("Stockholm areas", () => {
  it("covers every DeSO and RegSO in 11 boroughs", () => {
    expect(BOROUGHS).toHaveLength(11);
    expect(ALL_DESOS).toHaveLength(569);
    expect(NEIGHBOURHOODS).toHaveLength(127);
    expect(ALL_DESOS.every((d) => boroughForDeso(d))).toBe(true);
  });

  it("puts Gamla stan's neighbourhood in Södermalm and Örby Slott in Hägersten-Älvsjö", () => {
    expect(NEIGHBOURHOODS.find((n) => n.name === "Storkyrkan")?.borough).toBe("sodermalm");
    expect(NEIGHBOURHOODS.find((n) => n.name === "Örby Slott")?.borough).toBe("hagersten-alvsjo");
  });
});

describe("placeEvent", () => {
  it("matches stadsdelar, genitives and landmarks", () => {
    expect(placeEvent(event("Tre män grips på Fiskargatan på Södermalm.")).borough).toBe("sodermalm");
    expect(placeEvent(event("Bråk vid Södermalms tunnelbanestation.")).borough).toBe("sodermalm");
    expect(placeEvent(event("Larm om brand i flerbostadshus i Kista.")).borough).toBe("jarva");
    expect(placeEvent(event("En man rånas vid Odenplan.")).borough).toBe("norra-innerstaden");
  });

  it("prefers the longest name and the first place mentioned", () => {
    const e = placeEvent(event("Bilist stoppas i Hässelby strand efter jakt från Vällingby."));
    expect(e).toMatchObject({ borough: "hasselby-vallingby", place: "Hässelby strand" });
  });

  it("does not match parts of words", () => {
    expect(placeEvent(event("Polisen kontrollerar en bilist på E4:an.")).borough).toBeNull();
    expect(placeEvent(event("En farstavägg har vandaliserats.")).borough).toBeNull();
  });
});

describe("crime data", () => {
  it("has every category for every borough in the latest year", () => {
    for (const b of BOROUGHS) for (const c of CRIME_CATEGORIES) expect(crimeFor(b.id, c.key)).not.toBeNull();
  });
});
