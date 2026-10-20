// Builds data/stockholm/flood.json: how much of each DeSO's land is flooded in a 100-year cloudburst
// (skyfall), measured from MCF's (formerly MSB) flood hazard map for Stockholm.   npm run build-flood
//
// The map is only published as an image service, so the script downloads the layer for each DeSO at
// 5 m per pixel and counts pixels by depth class (read from the legend colours) inside the DeSO.
// Depths over 1.5 m are left out: in a cloudburst map they are almost only existing lakes and streams.
// Flooding from Mälaren and the sea is shown as a separate map layer, not computed.
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import proj4 from "proj4";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { fetchAreas, mapLimit } from "./lib/geo";
import nature from "../data/stockholm/nature.json";

const SERVICE = "https://gis-tjanster.mcf.se/arcgis/rest/services/Oversvamningskarteringar/hotkartor_2026/MapServer";
const LAYER = 201; // Stockholm, skyfall, 100-årsregn
const RESOLUTION = 5; // metres per pixel

/** Legend colours (RGB) of the depth classes. */
const CLASSES = [
  { key: "d0", label: "0–0,5 m", rgb: [187, 246, 252] },
  { key: "d05", label: "0,5–1 m", rgb: [119, 250, 252] },
  { key: "d10", label: "1–1,5 m", rgb: [55, 188, 250] },
  { key: "deep", label: "> 1,5 m", rgb: [12, 139, 250] },
] as const;

function classify(r: number, g: number, b: number) {
  let best = -1;
  let dist = Infinity;
  CLASSES.forEach((c, i) => {
    const d = (c.rgb[0] - r) ** 2 + (c.rgb[1] - g) ** 2 + (c.rgb[2] - b) ** 2;
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return dist < 900 ? best : -1; // ignore anti-aliased or unknown colours
}

const toSweref = (lon: number, lat: number) => proj4("EPSG:4326", "EPSG:3006", [lon, lat]);
const toWgs = (x: number, y: number) => proj4("EPSG:3006", "EPSG:4326", [x, y]);
proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

async function exportImage(x0: number, y0: number, w: number, h: number): Promise<PNG> {
  const params = new URLSearchParams({
    bbox: `${x0},${y0},${x0 + w * RESOLUTION},${y0 + h * RESOLUTION}`,
    bboxSR: "3006",
    imageSR: "3006",
    size: `${w},${h}`,
    format: "png32",
    transparent: "true",
    layers: `show:${LAYER}`,
    f: "image",
  });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${SERVICE}/export?${params}`);
    if (res.ok && res.headers.get("content-type")?.includes("png")) return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    if (attempt >= 2) throw new Error(`MCF export ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
}

async function main() {
  const desos = await fetchAreas("stat:DeSO_2025");
  const land = nature.deso as Record<string, { landHa: number }>;
  let done = 0;

  const rows = await mapLimit(desos, 3, async (d) => {
    const [a, b] = toSweref(d.bbox[0], d.bbox[1]);
    const [c, e] = toSweref(d.bbox[2], d.bbox[3]);
    const x0 = Math.floor(Math.min(a, c));
    const y0 = Math.floor(Math.min(b, e));
    const w = Math.ceil((Math.max(a, c) - x0) / RESOLUTION) + 1;
    const h = Math.ceil((Math.max(b, e) - y0) / RESOLUTION) + 1;
    const counts = [0, 0, 0, 0];
    // Large areas are fetched in tiles to stay within the service's image size limit.
    const TILE = 2000;
    for (let ty = 0; ty < h; ty += TILE) {
      for (let tx = 0; tx < w; tx += TILE) {
        const tw = Math.min(TILE, w - tx);
        const th = Math.min(TILE, h - ty);
        const ox = x0 + tx * RESOLUTION;
        const oy = y0 + ty * RESOLUTION;
        const png = await exportImage(ox, oy, tw, th);
        for (let j = 0; j < png.height; j++) {
          for (let i = 0; i < png.width; i++) {
            const k = (j * png.width + i) * 4;
            if (png.data[k + 3] === 0) continue;
            const cls = classify(png.data[k], png.data[k + 1], png.data[k + 2]);
            if (cls < 0) continue;
            // Image rows run top to bottom.
            const [lon, lat] = toWgs(ox + (i + 0.5) * RESOLUTION, oy + (th - j - 0.5) * RESOLUTION);
            if (booleanPointInPolygon(point([lon, lat]), d)) counts[cls]++;
          }
        }
      }
    }
    if (++done % 50 === 0) console.log(`${done}/${desos.length}`);
    const ha = (n: number) => (n * RESOLUTION * RESOLUTION) / 10_000;
    const landHa = land[d.properties.desokod]?.landHa ?? 0;
    const shallow = ha(counts[0]);
    const deeper = ha(counts[1] + counts[2]);
    return [
      d.properties.desokod,
      {
        landHa,
        floodedHa: Math.round((shallow + deeper) * 100) / 100,
        deepHa: Math.round(deeper * 100) / 100,
        share: landHa ? Math.min(1, (shallow + deeper) / landHa) : 0,
        deepShare: landHa ? Math.min(1, deeper / landHa) : 0,
      },
    ] as const;
  });

  writeFileSync(
    "data/stockholm/flood.json",
    JSON.stringify({
      source: "MCF (tidigare MSB), översvämningskartering skyfall Stockholm, 100-årsregn",
      fetched: new Date().toISOString().slice(0, 10),
      deso: Object.fromEntries(rows),
    }),
  );
  const shares = rows.map(([, r]) => r.share).sort((x, y) => x - y);
  console.log(`Wrote data/stockholm/flood.json – median ${(shares[Math.floor(shares.length / 2)] * 100).toFixed(1)} %, max ${(shares.at(-1)! * 100).toFixed(1)} %`);
}

main();
