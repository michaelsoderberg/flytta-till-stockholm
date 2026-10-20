// Builds data/stockholm/nature.json: green space, water and protected nature per DeSO, plus bathing
// sites with their EU water-quality classification.   npm run build-nature
//
// Sources:
//   SCB – Grönområden 2020 (geodata WFS) and land/water area per DeSO (TAB6420)
//   Naturvårdsverket – skyddade områden (INSPIRE ProtectedSite WFS)
//   Havs- och vattenmyndigheten – badplatser (bathing waters API v2)
import { writeFileSync } from "node:fs";
import area from "@turf/area";
import bbox from "@turf/bbox";
import centroid from "@turf/centroid";
import intersect from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { desoLocator, fetchAreas, mapLimit } from "./lib/geo";
import { desoRegionCode, queryTable } from "../lib/scb";

const BBOX = "17.75,59.22,18.20,59.44";
type Poly = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

async function wfs(base: string, typeName: string): Promise<Poly[]> {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: typeName,
    srsName: "EPSG:4326",
    bbox: `${BBOX},EPSG:4326`,
    outputFormat: "application/json",
  });
  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error(`${typeName} ${res.status}`);
  return ((await res.json()) as FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>).features.filter(
    (f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
  );
}

/** Area (m²) of each DeSO covered by the given polygons. */
function coverage(desos: Awaited<ReturnType<typeof fetchAreas>>, polys: Poly[]) {
  const out: Record<string, { m2: number; ids: Set<number> }> = {};
  const boxes = polys.map((p) => bbox(p));
  for (const d of desos) {
    const [x0, y0, x1, y1] = d.bbox;
    const acc = { m2: 0, ids: new Set<number>() };
    polys.forEach((p, i) => {
      const [a0, b0, a1, b1] = boxes[i];
      if (a1 < x0 || a0 > x1 || b1 < y0 || b0 > y1) return;
      try {
        const o = intersect(featureCollection([d, p]));
        if (o) {
          acc.m2 += area(o);
          acc.ids.add(i);
        }
      } catch {
        // Occasional invalid source geometry; skip it rather than fail the build.
      }
    });
    out[d.properties.desokod] = acc;
  }
  return out;
}

const DESIGNATION: Record<string, string> = {
  natureReserve: "Naturreservat",
  specialAreaOfConservation: "Natura 2000",
  specialProtectionArea: "Natura 2000 (fågeldirektivet)",
  siteOfCommunityImportance: "Natura 2000",
  naturalMonument: "Naturminne",
  habitatProtectionArea: "Biotopskydd",
  waterProtectionArea: "Vattenskyddsområde",
  nationalCityPark: "Nationalstadspark",
};

type BathingWater = {
  bathingWater: {
    id: string;
    name: string;
    municipality: { id: number };
    samplingPointPosition: { latitude: string; longitude: string };
    waterTypeIdText?: string;
  };
  adviceAgainstBathing?: unknown[];
};

const HAV = "https://gw.havochvatten.se/external-public/bathing-waters/v2";

async function main() {
  const [desos, locate] = await Promise.all([fetchAreas("stat:DeSO_2025"), desoLocator()]);

  // Land and water area per DeSO (hectares). 01 land, 02 inland water, 03 large lakes, 04 sea, 05 total.
  const areaTable = await queryTable("TAB6420", {
    Region: desos.map((d) => desoRegionCode(d.properties.desokod)),
    ArealTyp: ["01", "02", "03", "04", "05"],
    ContentsCode: ["000007E1"], // hektar
  });

  const green = await wfs("https://geodata.scb.se/geoserver/stat/wfs", "stat:Gronomraden_2020_tatort");
  console.log(`${green.length} grönområden`);
  const greenCover = coverage(desos, green);

  const protectedSites = await wfs("https://geodata.naturvardsverket.se/geoserver/ps/wfs", "ps:ProtectedSite");
  console.log(`${protectedSites.length} skyddade områden`);
  const protectedCover = coverage(desos, protectedSites);
  const sites = protectedSites.map((p, i) => {
    const props = p.properties as {
      siteName?: { GeographicalName?: { spelling?: { text?: string } } };
      siteDesignation?: { DesignationType?: { designation?: { "@href"?: string } } };
    };
    const designation = props.siteDesignation?.DesignationType?.designation?.["@href"] ?? "";
    const [lon, lat] = centroid(p).geometry.coordinates;
    return {
      i,
      // Names are sometimes prefixed with the register id, e.g. "2024689 Lovö".
      name: (props.siteName?.GeographicalName?.spelling?.text ?? "Namnlöst område").replace(/^\d+\s+/, ""),
      type: DESIGNATION[designation] ?? "Skyddat område",
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      ha: Math.round(area(p) / 10_000),
    };
  });

  const deso: Record<string, { landHa: number; waterShare: number; greenShare: number; protectedShare: number; protectedSites: number[] }> = {};
  for (const d of desos) {
    const code = d.properties.desokod;
    const ha = (t: string) => areaTable.get({ Region: desoRegionCode(code), ArealTyp: t }) ?? 0;
    const total = ha("05") || area(d) / 10_000;
    const land = ha("01") || total;
    deso[code] = {
      landHa: Math.round(land),
      waterShare: total ? (ha("02") + ha("03") + ha("04")) / total : 0,
      // Green space is mapped on land, so it is compared with the land area.
      greenShare: land ? Math.min(1, greenCover[code].m2 / 10_000 / land) : 0,
      protectedShare: Math.min(1, protectedCover[code].m2 / 10_000 / total),
      protectedSites: [...protectedCover[code].ids],
    };
  }

  // Bathing sites in Stockholm with their latest EU classification.
  const allWaters = ((await (await fetch(`${HAV}/bathing-waters`)).json()) as { watersAndAdvisories: BathingWater[] }).watersAndAdvisories;
  const stockholm = allWaters.filter((w) => w.bathingWater.municipality?.id === 180);
  const bathing = (
    await mapLimit(stockholm, 4, async (w) => {
      const b = w.bathingWater;
      const lat = Number(b.samplingPointPosition.latitude);
      const lon = Number(b.samplingPointPosition.longitude);
      const res = await fetch(`${HAV}/bathing-waters/${b.id}/profiles`);
      const profile = res.ok
        ? ((await res.json()) as { lastFourClassifications?: { year: number; qualityClassIdText: string }[] })
        : {};
      const latest = [...(profile.lastFourClassifications ?? [])].sort((x, y) => y.year - x.year)[0];
      return {
        id: b.id,
        name: b.name,
        lat,
        lon,
        deso: locate(lon, lat)?.deso ?? null,
        water: b.waterTypeIdText ?? null,
        quality: latest?.qualityClassIdText ?? null,
        qualityYear: latest?.year ?? null,
        advice: (w.adviceAgainstBathing?.length ?? 0) > 0,
      };
    })
  ).filter((b) => Number.isFinite(b.lat));
  console.log(`${bathing.length} badplatser`);

  writeFileSync(
    "data/stockholm/nature.json",
    JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), deso, protectedSites: sites, bathing }),
  );
  console.log("Wrote data/stockholm/nature.json");
}

main();
