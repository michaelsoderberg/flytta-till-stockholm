import { TIMEOUT_MS } from "@/lib/http";

const WFS = "https://geodata.scb.se/geoserver/stat/wfs";
const DAY = 60 * 60 * 24;

export type DesoFeature = {
  deso: string;
  regso: string;
  regsoNamn: string | null;
  kommunkod: string;
  geometry: GeoJSON.Geometry;
};

const DESO_PATTERN = /^\d{4}[A-C]\d{4}$/;

export function isDesoCode(code: string) {
  return DESO_PATTERN.test(code);
}

type WfsResponse = {
  features: { properties: Record<string, string>; geometry: GeoJSON.Geometry }[];
};

async function wfs(typeName: string, cql: string): Promise<WfsResponse> {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: typeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    cql_filter: cql,
  });
  const res = await fetch(`${WFS}?${params}`, {
    next: { revalidate: DAY * 30 },
    signal: AbortSignal.timeout(TIMEOUT_MS.wfs),
  });
  if (!res.ok) throw new Error(`SCB WFS ${res.status}`);
  return (await res.json()) as WfsResponse;
}

async function regsoName(regso: string): Promise<string | null> {
  const json = await wfs("stat:RegSO_2025", `regsokod='${regso}'`);
  return json.features[0]?.properties.regsonamn ?? null;
}

async function toFeature(json: WfsResponse): Promise<DesoFeature | null> {
  const f = json.features[0];
  if (!f) return null;
  const p = f.properties;
  return {
    deso: p.desokod,
    regso: p.regsokod,
    regsoNamn: await regsoName(p.regsokod),
    kommunkod: p.kommunkod,
    geometry: f.geometry,
  };
}

/** Finds the DeSO area (2025 division) that contains the point. */
export async function desoAtPoint(lat: number, lon: number): Promise<DesoFeature | null> {
  // GeoServer expects lon/lat order for EPSG:4326 in CQL.
  return toFeature(await wfs("stat:DeSO_2025", `INTERSECTS(sp_geometry,SRID=4326;POINT(${lon} ${lat}))`));
}

export async function regsoGeometry(regso: string): Promise<GeoJSON.Geometry | null> {
  if (!/^\d{4}R\d{3}$/.test(regso)) return null;
  const json = await wfs("stat:RegSO_2025", `regsokod='${regso}'`);
  return json.features[0]?.geometry ?? null;
}

export async function desoByCode(deso: string): Promise<DesoFeature | null> {
  if (!isDesoCode(deso)) return null;
  return toFeature(await wfs("stat:DeSO_2025", `desokod='${deso}'`));
}
