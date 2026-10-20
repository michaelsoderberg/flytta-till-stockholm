// Downloads reported crimes per stadsdelsområde in Stockholm from Brå's statistics database (SOL)
// and writes data/stockholm/crime.json. Brå has no API, so this replays what the SOL web form does.
// Run once a year after Brå publishes the final annual statistics (usually in March):
//   npm run fetch-bra
import { writeFileSync } from "node:fs";

const SOL = "https://statistik.bra.se/solwebb/action";
const MENU_ID = 101; // "Årsvis – Kommun och storstädernas stadsområden 1996–"
const FIRST_YEAR = 2015;
const UA = "Kommunkollen/0.1 (open data demo; yearly download)";

export const CATEGORIES = [
  { id: "5036", key: "totalt", label: "Brott totalt" },
  { id: "11495", key: "stold", label: "Stöld (utom inbrott och fordon)" },
  { id: "11096", key: "bedrageri", label: "Bedrägeri" },
  { id: "11099", key: "skadegorelse", label: "Skadegörelse" },
  { id: "11091", key: "frihet", label: "Olaga hot, ofredande m.m." },
  { id: "11130", key: "misshandel", label: "Misshandel" },
  { id: "11650", key: "narkotika", label: "Narkotikabrott" },
  { id: "11462", key: "bostadsinbrott", label: "Bostadsinbrott" },
  { id: "11093", key: "sexualbrott", label: "Sexualbrott" },
  { id: "11447", key: "fordon", label: "Fordonstillgrepp" },
  { id: "11522", key: "ran", label: "Rån" },
  { id: "11708", key: "vapen", label: "Vapenbrott" },
] as const;

/**
 * SOL region ids. Boroughs merged in 2021 and 2024 are reconstructed from their predecessors for
 * earlier years, so that every borough has a continuous series.
 */
const REGIONS: { id: string; sol: string; predecessors?: { until: number; sol: string[] } }[] = [
  { id: "stockholm", sol: "8510" },
  { id: "bromma", sol: "8511" },
  { id: "enskede-arsta-vantor", sol: "8512" },
  { id: "farsta", sol: "8513" },
  { id: "hagersten-alvsjo", sol: "8728", predecessors: { until: 2020, sol: ["8514", "8523"] } },
  { id: "hasselby-vallingby", sol: "8515" },
  { id: "jarva", sol: "8737", predecessors: { until: 2023, sol: ["8518", "8521"] } },
  { id: "kungsholmen", sol: "8516" },
  { id: "norra-innerstaden", sol: "8738", predecessors: { until: 2023, sol: ["8517", "8524"] } },
  { id: "skarpnack", sol: "8519" },
  { id: "skarholmen", sol: "8520" },
  { id: "sodermalm", sol: "8522" },
];

let cookie = "";

async function request(path: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(`${SOL}${path}`, {
    ...init,
    headers: { "User-Agent": UA, Cookie: cookie, ...(init.headers ?? {}) },
    redirect: "follow",
  });
  const setCookie = res.headers.get("set-cookie");
  const session = setCookie?.match(/JSESSIONID=[^;]+/)?.[0];
  if (session) cookie = session;
  if (!res.ok) throw new Error(`SOL ${path} ${res.status}`);
  return new TextDecoder("latin1").decode(await res.arrayBuffer());
}

const pause = () => new Promise((r) => setTimeout(r, 300));

type Cell = { count: number; per100k: number };

async function main() {
  await request("/start?menykatalogid=1");
  const menu = await request(`/anmalda/urval/urval?menyid=${MENU_ID}`);
  const periods = [...menu.matchAll(/arrayPeriod\[\d+\]\s*=\s*"(\d+)\*(\d{4})\*/g)]
    .map((m) => ({ id: m[1], year: Number(m[2]) }))
    .filter((p) => p.year >= FIRST_YEAR);
  if (!periods.length) throw new Error("No periods found – has the SOL menu changed?");

  const solIds = REGIONS.flatMap((r) => [r.sol, ...(r.predecessors?.sol ?? [])]);
  const regionNames = new Map<string, string>();
  for (const m of menu.matchAll(/arrayRegionNivaTva\[\d+\]\s*=\s*"(\d+)\*([^*]+)\*/g)) {
    regionNames.set(m[1], m[2].replace(/\\xA0/g, "").trim());
  }

  // raw[category][solRegionName][year]
  const raw: Record<string, Record<string, Record<number, Cell>>> = {};
  for (const cat of CATEGORIES) {
    const body = new URLSearchParams({
      brottstyp_id_string: cat.id,
      region_id_string: solIds.join("*"),
      period_id_string: periods.map((p) => p.id).join("*"),
      fordelning_id_string: "",
      antal: "1",
      antal_100k: "1",
    });
    await request("/anmalda/urval/vantapopup", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    await request("/anmalda/urval/sok");
    const text = await request("/anmalda/resultat/dbfil", { method: "POST" });
    const rows = text.split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(";"));
    const out: Record<string, Record<number, Cell>> = {};
    for (const [region, , , year, count, per100k] of rows) {
      if (count === ".." || !/^\d{4}$/.test(year)) continue;
      ((out[region] ??= {})[Number(year)] = { count: Number(count), per100k: Number(per100k) });
    }
    raw[cat.key] = out;
    console.log(`${cat.label}: ${Object.keys(out).length} regioner`);
    await pause();
  }

  const name = (sol: string) => {
    const n = regionNames.get(sol);
    if (!n) throw new Error(`Unknown SOL region ${sol}`);
    return n;
  };
  const years = periods.map((p) => p.year).sort();

  const data: Record<string, Record<string, Record<number, Cell>>> = {};
  for (const region of REGIONS) {
    data[region.id] = {};
    for (const cat of CATEGORIES) {
      const series: Record<number, Cell> = {};
      for (const year of years) {
        let cell: Cell | undefined;
        if (region.predecessors && year <= region.predecessors.until) {
          const parts = region.predecessors.sol.map((s) => raw[cat.key][name(s)]?.[year]);
          if (parts.every(Boolean)) {
            const count = parts.reduce((s, p) => s + p!.count, 0);
            // Population is recovered from each part's rate so the combined rate is exact.
            const population = parts.reduce((s, p) => s + (p!.per100k ? (p!.count / p!.per100k) * 100_000 : 0), 0);
            cell = { count, per100k: population ? Math.round((count / population) * 100_000) : 0 };
          }
        } else {
          cell = raw[cat.key][name(region.sol)]?.[year];
        }
        if (cell) series[year] = cell;
      }
      data[region.id][cat.key] = series;
    }
  }

  writeFileSync(
    "data/stockholm/crime.json",
    JSON.stringify(
      {
        source: "Brå, statistikdatabasen över anmälda brott (SOL)",
        fetched: new Date().toISOString().slice(0, 10),
        years,
        categories: CATEGORIES.map(({ key, label }) => ({ key, label })),
        regions: data,
      },
      null,
      1,
    ),
  );
  console.log(`Wrote data/stockholm/crime.json (${years[0]}–${years.at(-1)})`);
}

main();
