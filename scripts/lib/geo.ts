// Shared helpers for build scripts: Stockholm's SCB areas and coordinate conversion.
import proj4 from "proj4";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import areas from "../../data/stockholm/areas.json";

proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
/** SWEREF 99 18 00 – Stockholm stad's local grid. */
proj4.defs("EPSG:3011", "+proj=tmerc +lat_0=0 +lon_0=18 +k=1 +x_0=150000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

export const fromSweref99tm = (e: number, n: number) => proj4("EPSG:3006", "EPSG:4326", [e, n]) as [number, number];
export const fromSweref1800 = (e: number, n: number) => proj4("EPSG:3011", "EPSG:4326", [e, n]) as [number, number];

/** Reprojects every coordinate of a polygon geometry. */
export function reprojectGeometry<G extends Polygon | MultiPolygon>(g: G, fn: (x: number, y: number) => [number, number]): G {
  const ring = (r: number[][]) => r.map(([x, y]) => fn(x, y));
  if (g.type === "Polygon") return { ...g, coordinates: g.coordinates.map(ring) };
  return { ...g, coordinates: (g as MultiPolygon).coordinates.map((p) => p.map(ring)) } as G;
}

type Area = Feature<Polygon | MultiPolygon, Record<string, string>> & { bbox: number[] };

export async function fetchAreas(typeName: "stat:DeSO_2025" | "stat:RegSO_2025"): Promise<Area[]> {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: typeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    cql_filter: "kommunkod='0180'",
  });
  const res = await fetch(`https://geodata.scb.se/geoserver/stat/wfs?${params}`);
  if (!res.ok) throw new Error(`WFS ${typeName} ${res.status}`);
  const json = (await res.json()) as FeatureCollection<Polygon | MultiPolygon, Record<string, string>>;
  return json.features.map((f) => ({ ...f, bbox: bbox(f) }));
}

const DESO_BOROUGH = areas.deso as Record<string, string>;
const REGSO_OF_DESO = new Map(
  Object.entries(areas.regso as Record<string, { desos: string[] }>).flatMap(([code, r]) => r.desos.map((d) => [d, code] as const)),
);

export type Location = { deso: string; regso: string; borough: string };

/** Returns a locator that finds the Stockholm DeSO (and its RegSO and borough) containing a lon/lat. */
export async function desoLocator() {
  const desos = await fetchAreas("stat:DeSO_2025");
  return (lon: number, lat: number): Location | null => {
    const p = point([lon, lat]);
    for (const d of desos) {
      const [x0, y0, x1, y1] = d.bbox;
      if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
      if (booleanPointInPolygon(p, d)) {
        const deso = d.properties.desokod;
        return { deso, regso: REGSO_OF_DESO.get(deso)!, borough: DESO_BOROUGH[deso] };
      }
    }
    return null;
  };
}

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs tasks with limited concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
