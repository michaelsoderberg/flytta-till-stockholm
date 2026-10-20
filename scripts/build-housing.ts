// Builds data/stockholm/housing.json: planned and ongoing construction projects, rents, prices and
// queue times for rental flats.   npm run build-housing
//
// Sources:
//   Stockholms stad, "Stockholm växer" (vaxer.stockholm/projekt) – project map, SWEREF 99 18 00
//   SCB – rents per Stockholm stadsområde (TAB4603), sold houses (TAB1169), bostadsrätter (TAB1151)
//   Bostadsförmedlingen i Stockholm – queue time per stadsdel (bostad.stockholm.se/statistik)
// Open data has no sale prices below municipality level; the app says so and links to the sources.
import { writeFileSync } from "node:fs";
import areas from "../data/stockholm/areas.json";
import { queryTable } from "../lib/scb";
import { desoLocator, fromSweref1800, pause } from "./lib/geo";

const VAXER = "https://vaxer.stockholm/projekt/";
const BOSTAD = "https://bostad.stockholm.se/statistik/data";
const RENT_YEARS_FROM = "2016";
const PRICE_YEARS_FROM = "2015";

/** Extracts every top-level `{"geojson": ...}` layer embedded in the Stockholm växer page. */
function extractLayers(html: string) {
  const layers: { name: string; features: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] }[] = [];
  let i = 0;
  for (;;) {
    i = html.indexOf('{"geojson":', i);
    if (i < 0) break;
    // Find the matching closing brace, respecting strings.
    let depth = 0;
    let inString = false;
    let j = i;
    for (; j < html.length; j++) {
      const ch = html[j];
      if (inString) {
        if (ch === "\\") j++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) break;
    }
    const obj = JSON.parse(html.slice(i, j + 1));
    layers.push({ name: obj.name, features: obj.geojson.features });
    i = j + 1;
  }
  return layers;
}

/** "cirka 1 240 lägenheter" -> 1240 */
function homes(text: string): number | null {
  const m = text.match(/(\d{1,3}(?:[\s ]\d{3})*|\d+)\s+(?:nya\s+)?(?:bostäder|lägenheter|hem)\b/i);
  return m ? Number(m[1].replace(/[\s ]/g, "")) : null;
}

function status(text: string): "klart" | "byggs" | "planeras" | null {
  const t = text.toLowerCase();
  if (/(färdiginflyttad|är klar|stod klar|blev klar|är färdig|inflyttning skedde)/.test(t)) return "klart";
  if (/(byggstart|byggs|pågår|under uppförande|bygger)/.test(t)) return "byggs";
  if (/(planeras|detaljplan|samråd|granskning|planarbete|program)/.test(t)) return "planeras";
  return null;
}

async function projects() {
  const res = await fetch(VAXER, { headers: { "User-Agent": "Kommunkollen/0.1 (open data demo)" } });
  if (!res.ok) throw new Error(`vaxer.stockholm ${res.status}`);
  const layers = extractLayers(await res.text());
  const locate = await desoLocator();
  const out = [];
  for (const layer of layers) {
    for (const f of layer.features) {
      const [e, n] = f.geometry.coordinates;
      const [lon, lat] = fromSweref1800(e, n);
      const loc = locate(lon, lat);
      if (!loc) continue;
      const text = `${f.properties.name}. ${f.properties.content ?? ""}`;
      out.push({
        name: f.properties.name,
        category: layer.name,
        summary: f.properties.content ?? "",
        homes: layer.name === "Bostäder" ? homes(text) : null,
        status: status(text),
        url: f.properties.url ? new URL(f.properties.url, VAXER).toString() : null,
        lat: Number(lat.toFixed(5)),
        lon: Number(lon.toFixed(5)),
        ...loc,
      });
    }
  }
  console.log(`${out.length} projekt i ${layers.length} kategorier`);
  return out;
}

async function rents() {
  const t = await queryTable("TAB4603", {
    Region: ["0180", "I", "S", "V"],
    AntalRum: ["1", "2", "3", "4", "00"],
    Hyresuppg: ["Mh_lgh"],
    ContentsCode: ["00000126"],
    Tid: [`from(${RENT_YEARS_FROM})`],
  });
  const years = t.codes("Tid");
  const out: Record<string, { byRooms: Record<string, number | null>; trend: { year: number; value: number | null }[] }> = {};
  for (const region of ["0180", "I", "S", "V"]) {
    const latest = years.at(-1)!;
    out[region] = {
      byRooms: Object.fromEntries(["1", "2", "3", "4", "00"].map((r) => [r, t.get({ Region: region, AntalRum: r, Tid: latest })])),
      trend: years.map((y) => ({ year: Number(y), value: t.get({ Region: region, AntalRum: "00", Tid: y }) })),
    };
  }
  return { year: Number(years.at(-1)), regions: out };
}

async function prices() {
  const houses = await queryTable("TAB1169", {
    Region: ["0180", "01"],
    Fastighetstyp: ["220"],
    ContentsCode: ["BO0501C1", "BO0501C2"],
    Tid: [`from(${PRICE_YEARS_FROM})`],
  });
  const flats = await queryTable("TAB1151", {
    Region: ["0010"],
    ContentsCode: ["BO0501R6", "BO0501R8"],
    Tid: [`from(${PRICE_YEARS_FROM})`],
  });
  return {
    houses: houses.codes("Tid").map((y) => ({
      year: Number(y),
      count: houses.get({ Region: "0180", ContentsCode: "BO0501C1", Tid: y }),
      meanTkr: houses.get({ Region: "0180", ContentsCode: "BO0501C2", Tid: y }),
      lanMeanTkr: houses.get({ Region: "01", ContentsCode: "BO0501C2", Tid: y }),
    })),
    flats: flats.codes("Tid").map((y) => ({
      year: Number(y),
      count: flats.get({ Region: "0010", ContentsCode: "BO0501R6", Tid: y }),
      medianTkr: flats.get({ Region: "0010", ContentsCode: "BO0501R8", Tid: y }),
    })),
  };
}

const ALIASES: Record<string, string> = { spånga: "jarva", "ulvsunda industriområde": "bromma", "gamla stan": "sodermalm" };

/** Median of a histogram with 2-year buckets (last bucket "20+"), interpolated within the bucket. */
function histogramMedian(counts: number[]) {
  const total = counts.reduce((s, c) => s + c, 0);
  if (!total) return null;
  let acc = 0;
  for (let i = 0; i < counts.length; i++) {
    if (acc + counts[i] >= total / 2) return Math.round((i * 2 + ((total / 2 - acc) / counts[i]) * 2) * 10) / 10;
    acc += counts[i];
  }
  return null;
}

async function queueTimes() {
  const year = new Date().getFullYear() - 1; // last complete year
  const q = `year=${year}&queue=${encodeURIComponent("Bostadskön")}`;
  const list = (await (await fetch(`${BOSTAD}/omraden?${q}`)).json()) as { Kommun: string; Stadsdelar: string[] }[];
  const stadsdelar = list.find((k) => k.Kommun === "Stockholm")?.Stadsdelar ?? [];
  const boroughOf = new Map<string, string>();
  for (const b of areas.boroughs) for (const s of b.stadsdelar) boroughOf.set(s.toLocaleLowerCase("sv-SE"), b.id);
  boroughOf.set("ulvsunda industriområde", "bromma");
  for (const [k, v] of Object.entries(ALIASES)) boroughOf.set(k, v);

  const out = [];
  for (const name of stadsdelar) {
    const area = encodeURIComponent(`Stockholm - ${name.trim()}`);
    const res = await fetch(`${BOSTAD}/kotid-per-omrade?${q}&area=${area}&rooms=&apartmentType=&buildingType=`);
    if (!res.ok) continue;
    const json = (await res.json()) as { datasets: { data: number[] }[] };
    const counts = json.datasets[0]?.data ?? [];
    const borough = boroughOf.get(name.trim().toLocaleLowerCase("sv-SE")) ?? null;
    if (!borough) console.warn(`Okänd stadsdel hos Bostadsförmedlingen: ${name}`);
    out.push({ name: name.trim(), borough, flats: counts.reduce((s, c) => s + c, 0), medianYears: histogramMedian(counts), histogram: counts });
    await pause(200);
  }
  console.log(`${out.length} stadsdelar med kötid ${year}`);
  return { year, stadsdelar: out };
}

async function main() {
  const data = {
    fetched: new Date().toISOString().slice(0, 10),
    projects: await projects(),
    rents: await rents(),
    prices: await prices(),
    queue: await queueTimes(),
  };
  writeFileSync("data/stockholm/housing.json", JSON.stringify(data));
  console.log("Wrote data/stockholm/housing.json");
}

main();
