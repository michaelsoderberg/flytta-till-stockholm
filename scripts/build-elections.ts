// Builds data/stockholm/elections.json: 2026 election results (riksdag and kommun) per neighbourhood
// (RegSO), borough and for the whole city.
//
// Valmyndigheten publishes results per valdistrikt (voting district), whose boundaries do not follow SCB's
// areas. Each district's votes are split between the neighbourhoods it overlaps, in proportion to the
// overlapping area. Late-counted votes in "uppsamlingsdistrikt" have no geography and only count city-wide.
//
// Source: Valmyndigheten, val.se – "Rådata och statistik", 2026. Download URLs change when files are
// replaced; update FILES from the val.se page if a download fails.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import area from "@turf/area";
import bbox from "@turf/bbox";
import intersect from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import areas from "../data/stockholm/areas.json";
import { fetchAreas, fromSweref99tm, reprojectGeometry } from "./lib/geo";

const FILES = {
  riksdag:
    "https://www.val.se/download/18.7faaad3f1a0b0c300e458a/1790069872234/roster-per-distrikt-slutligt-antal-roster-inklusive-totalt-valdeltagande-riksdagsvalet-2026.xlsx",
  kommun:
    "https://www.val.se/download/18.7faaad3f1a0b0c300e41823/1791364806507/roster-per-distrikt-slutligt-antal-roster-inklusive-totalt-valdeltagande-kommunvalen-2026-.xlsx",
  districts: "https://www.val.se/download/18.332cf48819bd61ac15138a3/1785490318728/valdistrikt-stockholm-lan-2026.zip",
};

export const PARTIES: { key: string; name: string; match: string }[] = [
  { key: "S", name: "Socialdemokraterna", match: "Arbetarepartiet-Socialdemokraterna" },
  { key: "M", name: "Moderaterna", match: "Moderaterna" },
  { key: "V", name: "Vänsterpartiet", match: "Vänsterpartiet" },
  { key: "MP", name: "Miljöpartiet", match: "Miljöpartiet de gröna" },
  { key: "C", name: "Centerpartiet", match: "Centerpartiet" },
  { key: "SD", name: "Sverigedemokraterna", match: "Sverigedemokraterna" },
  { key: "L", name: "Liberalerna", match: "Liberalerna (tidigare Folkpartiet)" },
  { key: "KD", name: "Kristdemokraterna", match: "Kristdemokraterna" },
];
const PARTY_KEY = new Map(PARTIES.map((p) => [p.match, p.key]));
const TOTAL_ROWS = new Set(["Röstberättigade", "Valdeltagande", "Summa giltiga röster"]);

type Tally = { votes: Record<string, number>; valid: number; cast: number; eligible: number };

const emptyTally = (): Tally => ({ votes: Object.fromEntries([...PARTIES.map((p) => [p.key, 0]), ["OVR", 0]]), valid: 0, cast: 0, eligible: 0 });

function addScaled(target: Tally, source: Tally, w: number) {
  for (const [k, v] of Object.entries(source.votes)) target.votes[k] += v * w;
  target.valid += source.valid * w;
  target.cast += source.cast * w;
  target.eligible += source.eligible * w;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Reads per-district tallies for Stockholm (0180) from a Valmyndigheten results workbook. */
function readResults(buf: Buffer, sheet: "roster_RD" | "roster_KF"): Map<string, Tally> {
  const wb = XLSX.read(buf, { dense: true, sheets: [sheet, "Valdeltagande_distrikt"] });
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets[sheet]);
  const out = new Map<string, Tally>();
  for (const r of rows) {
    if (String(r["Kommunkod"]) !== "0180") continue;
    const code = String(r["Valdistriktskod"]);
    const t = out.get(code) ?? emptyTally();
    const category = String(r["Parti/kategori"]);
    const votes = Number(r["Röster"]) || 0;
    // The category column also carries totals and invalid votes; only parties count as votes.
    if (!category.startsWith("Ogiltiga") && !TOTAL_ROWS.has(category)) t.votes[PARTY_KEY.get(category) ?? "OVR"] += votes;
    t.valid = Number(r["Summa giltiga röster"]) || 0;
    t.eligible = Number(r["Röstberättigade"]) || 0;
    out.set(code, t);
  }
  const turnout = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets["Valdeltagande_distrikt"]);
  for (const r of turnout) {
    const t = out.get(String(r["Valdistriktskod"]));
    if (t) t.cast = Number(r["Röster"]) || 0;
  }
  return out;
}

function round(t: Tally) {
  return {
    votes: Object.fromEntries(Object.entries(t.votes).map(([k, v]) => [k, Math.round(v)])),
    valid: Math.round(t.valid),
    cast: Math.round(t.cast),
    eligible: Math.round(t.eligible),
  };
}

async function main() {
  // District boundaries (EPSG:3006) for Stockholm municipality.
  const dir = mkdtempSync(path.join(tmpdir(), "valdistrikt-"));
  writeFileSync(path.join(dir, "d.zip"), await download(FILES.districts));
  execFileSync("unzip", ["-o", "-q", path.join(dir, "d.zip"), "-d", dir]);
  const geojsonFile = readdirSync(dir).find((f) => f.endsWith(".geojson"))!;
  const districts = (JSON.parse(readFileSync(path.join(dir, geojsonFile), "utf8")) as FeatureCollection<Polygon | MultiPolygon, Record<string, string>>).features
    .filter((f) => f.properties.Kommunkod === "0180")
    .map((f) => ({ ...f, geometry: reprojectGeometry(f.geometry, fromSweref99tm) }));
  console.log(`${districts.length} valdistrikt`);

  // Share of each district's area that falls in each neighbourhood.
  const regsos = await fetchAreas("stat:RegSO_2025");
  const weights = new Map<string, { regso: string; w: number }[]>();
  for (const d of districts) {
    const total = area(d);
    const [x0, y0, x1, y1] = bbox(d);
    const parts: { regso: string; w: number }[] = [];
    for (const r of regsos) {
      const [a0, b0, a1, b1] = r.bbox;
      if (a1 < x0 || a0 > x1 || b1 < y0 || b0 > y1) continue;
      const overlap = intersect(featureCollection([d, r]));
      if (overlap) parts.push({ regso: r.properties.regsokod, w: area(overlap) / total });
    }
    const sum = parts.reduce((s, p) => s + p.w, 0);
    if (sum < 0.5) console.warn(`District ${d.properties.Valdistriktskod} only ${Math.round(sum * 100)} % inside RegSO`);
    weights.set(d.properties.Valdistriktskod, parts.map((p) => ({ ...p, w: p.w / sum })));
  }

  const result: Record<string, unknown> = {};
  for (const [election, sheet] of [["riksdag", "roster_RD"], ["kommun", "roster_KF"]] as const) {
    const tallies = readResults(await download(FILES[election]), sheet);
    const stad = emptyTally();
    const regso: Record<string, Tally> = {};
    let unplaced = 0;
    for (const [code, t] of tallies) {
      addScaled(stad, t, 1);
      const parts = weights.get(code);
      if (!parts) {
        unplaced += t.cast;
        continue;
      }
      for (const p of parts) addScaled((regso[p.regso] ??= emptyTally()), t, p.w);
    }
    const borough: Record<string, Tally> = {};
    for (const [code, t] of Object.entries(regso)) {
      const b = (areas.regso as Record<string, { borough: string }>)[code].borough;
      addScaled((borough[b] ??= emptyTally()), t, 1);
    }
    console.log(`${election}: ${tallies.size} distrikt, ${unplaced} röster i uppsamlingsdistrikt (bara i stadens total)`);
    result[election] = {
      stockholm: round(stad),
      borough: Object.fromEntries(Object.entries(borough).map(([k, v]) => [k, round(v)])),
      regso: Object.fromEntries(Object.entries(regso).map(([k, v]) => [k, round(v)])),
    };
  }

  mkdirSync("data/stockholm", { recursive: true });
  writeFileSync(
    "data/stockholm/elections.json",
    JSON.stringify({
      year: 2026,
      source: "Valmyndigheten, slutligt antal röster per valdistrikt 2026",
      parties: [...PARTIES.map(({ key, name }) => ({ key, name })), { key: "OVR", name: "Övriga partier" }],
      ...result,
    }),
  );
  console.log("Wrote data/stockholm/elections.json");
}

main();
