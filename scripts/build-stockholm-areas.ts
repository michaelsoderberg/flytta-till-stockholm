// Builds data/stockholm/areas.json and data/stockholm/boroughs.geojson.
//
// Each DeSO area in Stockholm is assigned to a stadsdelsområde (borough) by finding the stadsdel
// polygon that contains a point inside the DeSO, then looking up which borough that stadsdel belongs
// to (as of the 2023 reorganisation into 11 boroughs). Boroughs are drawn by merging their DeSO polygons.
//
// Sources:
//   DeSO/RegSO 2025 – SCB open geodata (WFS)
//   Stadsdelar – Stockholms stad (CC0), via github.com/krasch/stockholm-stadsdelar
import { mkdirSync, writeFileSync } from "node:fs";
import pointOnFeature from "@turf/point-on-feature";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import union from "@turf/union";
import simplify from "@turf/simplify";
import { featureCollection } from "@turf/helpers";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

const WFS = "https://geodata.scb.se/geoserver/stat/wfs";
const STADSDELAR_URL =
  "https://raw.githubusercontent.com/krasch/stockholm-stadsdelar/master/geojson/simplified/stadsdelar.geo.json";

/** Stadsdelsområden since 2023-07-01 and their stadsdelar (names as in the stadsdel dataset). */
const BOROUGHS: { id: string; name: string; stadsdelar: string[] }[] = [
  { id: "jarva", name: "Järva", stadsdelar: ["AKALLA", "BROMSTEN", "FLYSTA", "HANSTA", "HUSBY", "KISTA", "LUNDA", "RINKEBY", "SOLHEM", "SUNDBY", "TENSTA"] },
  { id: "hasselby-vallingby", name: "Hässelby-Vällingby", stadsdelar: ["GRIMSTA", "HÄSSELBY GÅRD", "HÄSSELBY STRAND", "HÄSSELBY VILLASTAD", "KÄLVESTA", "NÄLSTA", "RÅCKSTA", "VINSTA", "VÄLLINGBY"] },
  {
    id: "bromma",
    name: "Bromma",
    stadsdelar: ["ABRAHAMSBERG", "ALVIK", "BECKOMBERGA", "BLACKEBERG", "BROMMA KYRKA", "BÄLLSTA", "ENEBY", "HÖGLANDET", "MARIEHÄLL", "NOCKEBY", "NOCKEBYHOV", "NORRA ÄNGBY", "OLOVSLUND", "RIKSBY", "SMEDSLÄTTEN", "STORA MOSSEN", "SÖDRA ÄNGBY", "TRANEBERG", "ULVSUNDA", "ULVSUNDA INDUSTRIOMR", "ÅKESHOV", "ÅKESLUND", "ÅLSTEN", "ÄPPELVIKEN"],
  },
  { id: "kungsholmen", name: "Kungsholmen", stadsdelar: ["KUNGSHOLMEN", "STADSHAGEN", "KRISTINEBERG", "FREDHÄLL", "MARIEBERG", "LILLA ESSINGEN", "STORA ESSINGEN"] },
  { id: "norra-innerstaden", name: "Norra innerstaden", stadsdelar: ["DJURGÅRDEN", "LADUGÅRDSGÄRDET", "HJORTHAGEN", "NORRA DJURGÅRDEN", "NORRMALM", "SKEPPSHOLMEN", "VASASTADEN", "ÖSTERMALM"] },
  { id: "sodermalm", name: "Södermalm", stadsdelar: ["GAMLA STAN", "RIDDARHOLMEN", "LÅNGHOLMEN", "REIMERSHOLME", "SÖDERMALM", "SÖDRA HAMMARBYHAMNEN"] },
  {
    id: "hagersten-alvsjo",
    name: "Hägersten-Älvsjö",
    stadsdelar: ["ASPUDDEN", "FRUÄNGEN", "GRÖNDAL", "HERRÄNGEN", "HÄGERSTEN", "HÄGERSTENSÅSEN", "LILJEHOLMEN", "LISEBERG", "LÅNGBRO", "LÅNGSJÖ", "MIDSOMMARKRANSEN", "MÄLARHÖJDEN", "SOLBERGA", "VÄSTBERGA", "VÄSTERTORP", "ÄLVSJÖ", "ÖRBY SLOTT"],
  },
  { id: "skarholmen", name: "Skärholmen", stadsdelar: ["BREDÄNG", "SÄTRA", "SKÄRHOLMEN", "VÅRBERG"] },
  { id: "enskede-arsta-vantor", name: "Enskede-Årsta-Vantör", stadsdelar: ["BANDHAGEN", "ENSKEDEFÄLTET", "ENSKEDE GÅRD", "GAMLA ENSKEDE", "HAGSÄTRA", "HÖGDALEN", "JOHANNESHOV", "RÅGSVED", "STUREBY", "ÅRSTA", "ÖRBY", "ÖSTBERGA"] },
  { id: "skarpnack", name: "Skarpnäck", stadsdelar: ["HAMMARBYHÖJDEN", "BJÖRKHAGEN", "ENSKEDEDALEN", "KÄRRTORP", "BAGARMOSSEN", "SKARPNÄCKS GÅRD", "FLATEN", "ORHEM", "SKRUBBA"] },
  { id: "farsta", name: "Farsta", stadsdelar: ["FAGERSJÖ", "FARSTA", "FARSTANÄSET", "FARSTA STRAND", "GUBBÄNGEN", "HÖKARÄNGEN", "LARSBODA", "SKÖNDAL", "SVEDMYRA", "TALLKROGEN"] },
];

type Area = Feature<Polygon | MultiPolygon, Record<string, string>>;

async function wfs(typeName: string): Promise<Area[]> {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: typeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    cql_filter: "kommunkod='0180'",
  });
  const res = await fetch(`${WFS}?${params}`);
  if (!res.ok) throw new Error(`WFS ${typeName} ${res.status}`);
  return ((await res.json()) as FeatureCollection<Polygon | MultiPolygon, Record<string, string>>).features;
}

async function main() {
  const boroughOfStadsdel = new Map<string, string>();
  for (const b of BOROUGHS) for (const s of b.stadsdelar) boroughOfStadsdel.set(s, b.id);

  const stadsdelar = ((await (await fetch(STADSDELAR_URL)).json()) as FeatureCollection<Polygon | MultiPolygon, { name: string }>)
    .features;
  const unmapped = stadsdelar.map((f) => f.properties.name).filter((n) => !boroughOfStadsdel.has(n));
  if (unmapped.length) throw new Error(`Stadsdelar without borough: ${unmapped.join(", ")}`);
  if (boroughOfStadsdel.size !== stadsdelar.length) {
    const names = new Set(stadsdelar.map((f) => f.properties.name));
    throw new Error(`Unknown stadsdelar in mapping: ${[...boroughOfStadsdel.keys()].filter((n) => !names.has(n)).join(", ")}`);
  }

  const [desos, regsos, desos2018] = await Promise.all([
    wfs("stat:DeSO_2025"),
    wfs("stat:RegSO_2025"),
    wfs("stat:DeSO_2018"),
  ]);

  const desoBorough: Record<string, string> = {};
  for (const d of desos) {
    const point = pointOnFeature(d);
    const hit = stadsdelar.find((s) => booleanPointInPolygon(point, s));
    if (!hit) throw new Error(`DeSO ${d.properties.desokod} is outside all stadsdelar`);
    desoBorough[d.properties.desokod] = boroughOfStadsdel.get(hit.properties.name)!;
  }

  // A RegSO belongs to the borough most of its DeSOs belong to; disagreements are reported.
  const regso: Record<string, { name: string; borough: string; desos: string[] }> = {};
  for (const r of regsos) {
    const code = r.properties.regsokod;
    const members = desos.filter((d) => d.properties.regsokod === code).map((d) => d.properties.desokod);
    const counts = new Map<string, number>();
    for (const m of members) counts.set(desoBorough[m], (counts.get(desoBorough[m]) ?? 0) + 1);
    const borough = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (counts.size > 1) console.warn(`RegSO ${r.properties.regsonamn} spans ${[...counts.keys()].join(", ")} – using ${borough}`);
    regso[code] = { name: r.properties.regsonamn, borough, desos: members };
  }

  // SCB publishes years up to 2023 for the 2018 DeSO division only. Each 2018 area is assigned to the
  // borough and 2025 neighbourhood its interior point falls in, so time series can span both divisions.
  const deso2018: Record<string, { borough: string; regso: string | null }> = {};
  for (const d of desos2018) {
    const point = pointOnFeature(d);
    const hit = stadsdelar.find((s) => booleanPointInPolygon(point, s));
    if (!hit) throw new Error(`DeSO 2018 ${d.properties.desokod} is outside all stadsdelar`);
    const r = regsos.find((x) => booleanPointInPolygon(point, x));
    deso2018[d.properties.desokod] = { borough: boroughOfStadsdel.get(hit.properties.name)!, regso: r?.properties.regsokod ?? null };
  }
  const unplaced = Object.entries(deso2018).filter(([, v]) => !v.regso);
  if (unplaced.length) console.warn(`DeSO 2018 without RegSO 2025: ${unplaced.map(([k]) => k).join(", ")}`);

  const boroughFeatures = BOROUGHS.map((b) => {
    const parts = desos.filter((d) => desoBorough[d.properties.desokod] === b.id);
    const merged = union(featureCollection(parts));
    if (!merged) throw new Error(`Could not merge ${b.name}`);
    const simplified = simplify(merged, { tolerance: 0.0004, highQuality: true });
    simplified.properties = { id: b.id, name: b.name };
    return simplified;
  });

  mkdirSync("data/stockholm", { recursive: true });
  writeFileSync(
    "data/stockholm/areas.json",
    JSON.stringify({ boroughs: BOROUGHS, deso: desoBorough, regso, deso2018 }, null, 1),
  );
  writeFileSync("data/stockholm/boroughs.geojson.json", JSON.stringify(featureCollection(boroughFeatures)));

  for (const b of BOROUGHS) {
    const n = Object.values(desoBorough).filter((x) => x === b.id).length;
    const r = Object.values(regso).filter((x) => x.borough === b.id).length;
    const o = Object.values(deso2018).filter((x) => x.borough === b.id).length;
    console.log(`${b.name.padEnd(22)} ${String(n).padStart(3)} DeSO  ${String(r).padStart(3)} RegSO  ${String(o).padStart(3)} DeSO 2018`);
  }
}

main();
