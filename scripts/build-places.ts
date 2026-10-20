// Builds data/stockholm/places.json: shops, restaurants, healthcare and leisure from OpenStreetMap,
// each placed in its Stockholm DeSO. Overpass is shared infrastructure, so this runs as a script
// (e.g. weekly), never per page view.   npm run build-places
//
// Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
import { writeFileSync } from "node:fs";
import { desoLocator } from "./lib/geo";

/** overpass-api.de is often overloaded; mirrors are tried in order. */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const QUERY = `[out:json][timeout:180];
area["boundary"="administrative"]["admin_level"="7"]["ref:scb"="0180"]->.a;
( nwr["shop"~"^(supermarket|convenience)$"](area.a);
  nwr["amenity"~"^(restaurant|cafe|fast_food|pharmacy|clinic|doctors|hospital|dentist|library)$"](area.a);
  nwr["leisure"~"^(fitness_centre|playground)$"](area.a); );
out center tags;`;

type Element = { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> };

/** OSM tag value -> app category. */
const CATEGORY: Record<string, string> = {
  supermarket: "matbutik",
  convenience: "narbutik",
  restaurant: "restaurang",
  cafe: "kafe",
  fast_food: "snabbmat",
  pharmacy: "apotek",
  clinic: "vard",
  doctors: "vard",
  hospital: "sjukhus",
  dentist: "tandvard",
  library: "bibliotek",
  fitness_centre: "gym",
  playground: "lekplats",
};

async function overpass(): Promise<Element[]> {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: QUERY }),
        headers: { "User-Agent": "Kommunkollen/0.1 (open data demo)" },
      });
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { elements: Element[] }).elements;
    } catch (err) {
      console.warn(`${url} failed: ${err}`);
    }
  }
  throw new Error("All Overpass endpoints failed");
}

async function main() {
  const [elements, locate] = await Promise.all([overpass(), desoLocator()]);
  const items = [];
  for (const e of elements) {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const tag = e.tags.shop ?? e.tags.amenity ?? e.tags.leisure;
    const c = CATEGORY[tag];
    if (lat == null || lon == null || !c) continue;
    const loc = locate(lon, lat);
    if (!loc) continue;
    items.push({ n: e.tags.name ?? null, c, lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)), d: loc.deso });
  }
  writeFileSync("data/stockholm/places.json", JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), items }));
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.c] = (counts[i.c] ?? 0) + 1;
  console.log(`Wrote data/stockholm/places.json (${items.length} platser)`, counts);
}

main();
