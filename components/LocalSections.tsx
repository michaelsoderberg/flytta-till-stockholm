import Card from "@/components/Card";
import ElectionChart from "@/components/ElectionChart";
import ExploreMap from "@/components/ExploreMapLazy";
import type { MapGroup } from "@/components/ExploreMap";
import SchoolTable from "@/components/SchoolTable";
import {
  ELECTION_YEAR,
  electionFor,
  floodFor,
  housingFor,
  natureFor,
  nearestBathing,
  PARTIES,
  PLACE_CATEGORIES,
  placeCounts,
  placesIn,
  schoolsIn,
  stadFlood,
  weightedSchoolMean,
} from "@/lib/local";
import type { AreaStats } from "@/lib/profile";
import { ALL_DESOS } from "@/lib/stockholm";

export type LocalArea = {
  name: string;
  desos: string[];
  boroughId: string;
  geometry: GeoJSON.Geometry;
  center: [number, number];
  stats: AreaStats;
  stadStats: AreaStats;
  /** Which election level to read: a borough or a neighbourhood (RegSO). */
  election: { level: "borough" | "regso"; code: string };
};

const pct = (v: number | null | undefined, d = 0) =>
  v == null ? "–" : `${(v * 100).toLocaleString("sv-SE", { maximumFractionDigits: d, minimumFractionDigits: d })} %`;
const int = (v: number | null | undefined) => (v == null ? "–" : Math.round(v).toLocaleString("sv-SE"));
const kr = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v).toLocaleString("sv-SE")} kr`);

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-page p-3">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-0.5 text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/** Categorical slots from the validated reference palette, in fixed order. */
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];

export function MapCard({ area }: { area: LocalArea }) {
  const { schools, preschools } = schoolsIn(area.desos);
  const places = placesIn(area.desos);
  const nature = natureFor(area.desos);
  const housing = housingFor(area.desos, area.boroughId);
  const pick = (cats: string[]) =>
    places.filter((p) => cats.includes(p.c)).map((p) => ({ lat: p.lat, lon: p.lon, label: p.n ?? "Namnlös", sub: PLACE_CATEGORIES.find((c) => c.key === p.c)?.label }));
  const groups: MapGroup[] = [
    {
      key: "skolor",
      label: "Skolor",
      color: COLORS[0],
      on: true,
      markers: schools.filter((s) => s.lat != null).map((s) => ({
        lat: s.lat!,
        lon: s.lon!,
        label: s.name,
        sub: `${s.kind === "grundskola" ? "Grundskola" : "Gymnasium"}, ${s.owner.toLowerCase()}${s.merit9 ? ` · meritvärde ${s.merit9}` : ""}`,
        href: s.web,
      })),
    },
    {
      key: "forskolor",
      label: "Förskolor",
      color: COLORS[1],
      markers: preschools.map((p) => ({ lat: p.lat, lon: p.lon, label: p.name, sub: `Förskola, ${p.owner.toLowerCase()}`, href: p.web })),
    },
    { key: "mat", label: "Matbutiker", color: COLORS[2], on: true, markers: pick(["matbutik", "narbutik"]) },
    { key: "restauranger", label: "Restauranger och kaféer", color: COLORS[3], markers: pick(["restaurang", "kafe", "snabbmat"]) },
    { key: "vard", label: "Vård och apotek", color: COLORS[6], markers: pick(["vard", "sjukhus", "tandvard", "apotek"]) },
    {
      key: "bad",
      label: "Badplatser",
      color: COLORS[4],
      markers: (nature.bathing.length ? nature.bathing : nearestBathing(area.center)).map((b) => ({
        lat: b.lat,
        lon: b.lon,
        label: b.name,
        sub: b.quality ? `Vattenkvalitet: ${b.quality.toLowerCase()} (${b.qualityYear})` : undefined,
      })),
    },
    {
      key: "bygg",
      label: "Byggprojekt",
      color: COLORS[5],
      markers: housing.projects.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        label: p.name ?? "Projekt",
        sub: `${p.category}${p.homes ? ` · ca ${p.homes} bostäder` : ""}`,
        href: p.url,
      })),
    },
  ];
  return (
    <Card
      id="karta"
      title="Utforska på kartan"
      subtitle="Slå på och av lager. Klicka på en punkt för mer information."
      source="Skolverket, Stockholms stad, OpenStreetMap-bidragsgivare (ODbL), Havs- och vattenmyndigheten, MCF (översvämningskartor)."
    >
      <ExploreMap geometry={area.geometry} groups={groups} />
    </Card>
  );
}

export function SchoolsCard({ area }: { area: LocalArea }) {
  const { schools, preschools } = schoolsIn(area.desos);
  const stad = schoolsIn(ALL_DESOS).schools;
  const gr = schools.filter((s) => s.kind === "grundskola");
  const gy = schools.filter((s) => s.kind === "gymnasium");
  const merit = weightedSchoolMean(gr, "merit9");
  const stadMerit = weightedSchoolMean(stad.filter((s) => s.kind === "grundskola"), "merit9");
  const certified = weightedSchoolMean(schools, "certifiedTeachers");
  const stadCertified = weightedSchoolMean(stad, "certifiedTeachers");
  const children = (area.stats.ageBands.find((b) => b.code === "-4")?.count ?? 0);
  const owners = (list: { owner: string }[]) => {
    const k = list.filter((s) => s.owner === "Kommunal").length;
    return `${k} kommunala, ${list.length - k} fristående`;
  };
  const period = gr.find((s) => s.meritPeriod)?.meritPeriod;
  return (
    <Card
      id="skolor"
      title="Skolor och förskolor"
      subtitle={`Skolor som ligger i ${area.name}. Elever kan välja skola i hela staden, så även skolor utanför området kan vara aktuella.`}
      source={`Skolverket (Skolenhetsregistret och statistik${period ? `, meritvärde ${period}` : ""}), Stockholms stad (förskolor). Snitten är viktade efter antal elever.`}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Grundskolor" value={int(gr.length)} sub={owners(gr)} />
        <Tile label="Gymnasieskolor" value={int(gy.length)} sub={gy.length ? owners(gy) : undefined} />
        <Tile label="Förskolor" value={int(preschools.length)} sub={`${int(children)} barn 0–4 år bor här`} />
        <Tile label="Meritvärde åk 9, snitt" value={merit ? merit.toLocaleString("sv-SE", { maximumFractionDigits: 0 }) : "–"} sub={`Stockholm ${int(stadMerit)}`} />
      </div>
      <p className="mt-3 text-sm text-ink-2">
        Andel legitimerade lärare i områdets skolor: <strong className="text-ink">{certified ? `${Math.round(certified)} %` : "–"}</strong>{" "}
        (Stockholm {stadCertified ? `${Math.round(stadCertified)} %` : "–"}).
      </p>
      <div className="mt-4">
        <SchoolTable
          rows={schools.map((s) => ({
            code: s.code,
            name: s.name,
            kind: s.kind,
            owner: s.owner,
            web: s.web,
            merit9: s.merit9,
            meritSuppressed: s.meritSuppressed,
            eligible9: s.eligible9,
            certifiedTeachers: s.certifiedTeachers,
            studentsPerTeacher: s.studentsPerTeacher,
            pupils: s.pupils,
          }))}
        />
      </div>
    </Card>
  );
}

export function ServicesCard({ area }: { area: LocalArea }) {
  const counts = placeCounts(placesIn(area.desos));
  const stadCounts = placeCounts(placesIn(ALL_DESOS));
  const per10k = (n: number, pop: number) => (pop ? (n / pop) * 10_000 : 0);
  const rows = PLACE_CATEGORIES.map((c) => ({
    ...c,
    n: counts[c.key] ?? 0,
    rate: per10k(counts[c.key] ?? 0, area.stats.population),
    stadRate: per10k(stadCounts[c.key] ?? 0, area.stadStats.population),
  }));
  const max = Math.max(...rows.map((r) => Math.max(r.rate, r.stadRate)));
  return (
    <Card
      id="service"
      title="Butiker, vård och restauranger"
      subtitle={`Hur mycket service som finns i ${area.name}, i förhållande till antalet invånare.`}
      source="OpenStreetMap-bidragsgivare (ODbL). Kartan är frivilligt sammanställd och kan sakna enstaka ställen."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-2">
              <th className="py-2 font-medium">Typ</th>
              <th className="py-2 text-right font-medium">Antal</th>
              <th className="py-2 pl-4 font-medium">Per 10 000 invånare</th>
              <th className="py-2 text-right font-medium">Stockholm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line last:border-0">
                <td className="py-2">{r.label}</td>
                <td className="tabular py-2 text-right">{r.n}</td>
                <td className="py-2 pl-4">
                  <div className="flex items-center gap-2">
                    <span className="relative h-2.5 w-32 rounded-full bg-grid">
                      <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${max ? (r.rate / max) * 100 : 0}%` }} />
                      <span className="absolute -top-0.5 h-3.5 w-0.5 bg-ink-2" style={{ left: `${max ? (r.stadRate / max) * 100 : 0}%` }} title="Stockholm" />
                    </span>
                    <span className="tabular">{r.rate.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}</span>
                  </div>
                </td>
                <td className="tabular py-2 text-right text-muted">{r.stadRate.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Strecket i stapeln visar Stockholms snitt.</p>
    </Card>
  );
}

export function NatureCard({ area }: { area: LocalArea }) {
  const n = natureFor(area.desos);
  const stad = natureFor(ALL_DESOS);
  const bathing = n.bathing.length ? n.bathing.map((b) => ({ ...b, km: null as number | null })) : nearestBathing(area.center);
  return (
    <Card
      id="natur"
      title="Natur och vatten"
      subtitle={`Grönområden, vatten och skyddad natur i ${area.name}, och de närmaste badplatserna.`}
      source="SCB (grönområden 2020, land- och vattenareal), Naturvårdsverket (skyddade områden), Havs- och vattenmyndigheten (badplatser, EU-klassning)."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Grönområden av landytan" value={pct(n.greenShare)} sub={`Stockholm ${pct(stad.greenShare)}`} />
        <Tile label="Vatten av totala ytan" value={pct(n.waterShare)} sub={`Stockholm ${pct(stad.waterShare)}`} />
        <Tile label="Skyddad natur av ytan" value={pct(n.protectedShare)} sub={`Stockholm ${pct(stad.protectedShare)}`} />
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Skyddad natur</h3>
          {n.protectedSites.length === 0 ? (
            <p className="mt-1 text-sm text-ink-2">Inga skyddade naturområden i området.</p>
          ) : (
            <ul className="mt-1 divide-y divide-line text-sm">
              {n.protectedSites.slice(0, 8).map((s) => (
                <li key={s.i} className="flex justify-between gap-3 py-1.5">
                  <span>{s.name}</span>
                  <span className="text-muted">{s.type === "Skyddat område" ? "Skyddad natur" : s.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium">{n.bathing.length ? "Badplatser i området" : "Närmaste badplatser"}</h3>
          <ul className="mt-1 divide-y divide-line text-sm">
            {bathing.map((b) => (
              <li key={b.id} className="flex justify-between gap-3 py-1.5">
                <span>
                  {b.name}
                  {b.km != null && <span className="text-muted"> · {b.km.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km</span>}
                </span>
                <span className="text-muted">{b.quality ?? "–"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Vattenkvalitet enligt EU:s badvattenklassning för senaste säsongen.</p>
        </div>
      </div>
    </Card>
  );
}

export function FloodCard({ area }: { area: LocalArea }) {
  const f = floodFor(area.desos);
  const s = stadFlood();
  return (
    <Card
      id="oversvamning"
      title="Översvämningsrisk"
      subtitle="Hur stor del av marken som översvämmas vid ett kraftigt skyfall (ett regn som statistiskt sker en gång på 100 år)."
      source="MCF (tidigare MSB), skyfallskartering för Stockholm. Andelarna är uträknade från kartbilden med 5 meters upplösning; djup över 1,5 m räknas bort eftersom det nästan bara är befintliga sjöar och vattendrag."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Mark som får stående vatten" value={pct(f.share, 1)} sub={`Stockholm ${pct(s.share, 1)}`} />
        <Tile label="Varav mer än en halv meter" value={pct(f.deepShare, 1)} sub={`Stockholm ${pct(s.deepShare, 1)}`} />
        <Tile label="Påverkad yta" value={`${int(f.floodedHa)} ha`} sub={`av ${int(f.landHa)} ha mark`} />
      </div>
      <p className="mt-3 text-sm text-ink-2">
        Slå på lagret <strong>Översvämning vid skyfall</strong> på kartan för att se exakt var vatten samlas, och{" "}
        <strong>Mälaren, 100-årsflöde</strong> för höga nivåer i Mälaren. Stående vatten i en innergård eller på en gata är
        vanligt; risken gäller främst källare, bottenvåningar och garage i lågpunkter.
      </p>
    </Card>
  );
}

export function HousingCard({ area }: { area: LocalArea }) {
  const h = housingFor(area.desos, area.boroughId);
  const homes = h.projects.filter((p) => p.category === "Bostäder").sort((a, b) => (b.homes ?? 0) - (a.homes ?? 0));
  const other = h.projects.filter((p) => p.category !== "Bostäder");
  const newBuildings = (s: AreaStats) => s.buildingAge.find((b) => b.code === "2021-2030")?.share ?? 0;
  const rooms = [
    { key: "1", label: "1 rum" },
    { key: "2", label: "2 rum" },
    { key: "3", label: "3 rum" },
    { key: "4", label: "4+ rum" },
  ];
  const lastHouse = h.prices.houses.at(-1);
  const lastFlat = h.prices.flats.at(-1);
  // The area's own stadsdel first, then the rest of the borough by queue time.
  const own = (q: { name: string }) => q.name.toLocaleLowerCase("sv-SE") === area.name.toLocaleLowerCase("sv-SE");
  const queue = [...h.queue.stadsdelar].sort((a, b) => Number(own(b)) - Number(own(a)) || (b.medianYears ?? 0) - (a.medianYears ?? 0));
  const statusLabel = { klart: "Klart", byggs: "Byggs", planeras: "Planeras" } as const;

  return (
    <Card
      id="bostader"
      title="Bostäder och byggande"
      subtitle={`Hyror, kötider, priser och vad som planeras och byggs i ${area.name}.`}
      source={`Stockholms stad (Stockholm växer, ${h.projects.length} projekt i området), SCB (hyror ${h.rent.year}, bostadspriser), Bostadsförmedlingen (kötider ${h.queue.year}).`}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={`Medianhyra, ${h.rent.area}`} value={kr(h.rent.local?.byRooms["00"])} sub={`Stockholm ${kr(h.rent.stad?.byRooms["00"])} /mån`} />
        <Tile label="Planerade bostäder" value={int(h.homesPlanned)} sub={`i ${homes.length} bostadsprojekt`} />
        <Tile label="Bostäder byggda 2021–" value={pct(newBuildings(area.stats), 1)} sub={`Stockholm ${pct(newBuildings(area.stadStats), 1)}`} />
        <Tile label="Villa, snittpris i staden" value={lastHouse?.meanTkr ? `${(lastHouse.meanTkr / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} mkr` : "–"} sub={`${lastHouse?.year}, ${int(lastHouse?.count)} sålda`} />
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Hyra per månad (median) – {h.rent.area}</h3>
          <table className="mt-1 w-full text-sm">
            <tbody>
              {rooms.map((r) => (
                <tr key={r.key} className="border-b border-line last:border-0">
                  <td className="py-1.5">{r.label}</td>
                  <td className="tabular py-1.5 text-right">{kr(h.rent.local?.byRooms[r.key])}</td>
                  <td className="tabular py-1.5 text-right text-muted">Stockholm {kr(h.rent.stad?.byRooms[r.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-muted">
            SCB redovisar hyror för inre staden, Söderort och Västerort – inte per stadsdel.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Kötid för hyresrätt via bostadskön ({h.queue.year})</h3>
          {queue.length === 0 ? (
            <p className="mt-1 text-sm text-ink-2">Ingen statistik.</p>
          ) : (
            <table className="mt-1 w-full text-sm">
              <tbody>
                {queue.slice(0, 8).map((q) => (
                  <tr key={q.name} className={`border-b border-line last:border-0 ${own(q) ? "font-semibold" : ""}`}>
                    <td className="py-1.5">{q.name}</td>
                    <td className="tabular py-1.5 text-right">{q.medianYears != null ? `${q.medianYears.toLocaleString("sv-SE")} år` : "–"}</td>
                    <td className="tabular py-1.5 text-right text-muted">{q.flats} förmedlade</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-1 text-xs text-muted">Mediankötid för lägenheter som förmedlades under året.</p>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-medium">Bostadsprojekt</h3>
        {homes.length === 0 ? (
          <p className="mt-1 text-sm text-ink-2">Inga bostadsprojekt i Stockholm växer för området.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line text-sm">
            {homes.slice(0, 10).map((p) => (
              <li key={p.url ?? p.name} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{p.name}</a>
                  ) : (
                    p.name
                  )}
                </span>
                <span className="text-xs text-muted">
                  {p.homes ? `ca ${int(p.homes)} bostäder` : ""}
                  {p.status ? ` · ${statusLabel[p.status as keyof typeof statusLabel]}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {other.length > 0 && (
          <p className="mt-2 text-sm text-ink-2">
            Dessutom {other.length} andra projekt (
            {Object.entries(other.reduce<Record<string, number>>((acc, p) => ((acc[p.category] = (acc[p.category] ?? 0) + 1), acc), {}))
              .map(([k, v]) => `${k.toLowerCase()} ${v}`)
              .join(", ")}
            ) – se lagret Byggprojekt på kartan.
          </p>
        )}
      </div>

      <p className="mt-4 rounded-lg bg-page p-3 text-xs text-ink-2">
        <strong>Om bostadspriser:</strong> öppna data om köpta bostadsrätter och villor finns bara för hela kommunen eller
        Stor-Stockholm. Medianpriset för en bostadsrätt i Stor-Stockholm var {lastFlat?.medianTkr ? `${(lastFlat.medianTkr / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} mkr` : "–"} ({lastFlat?.year}).
        För priser i just {area.name}, se mäklarstatistik hos t.ex. Hemnet eller Booli.
      </p>
    </Card>
  );
}

export function ElectionsCard({ area }: { area: LocalArea }) {
  const data = {
    riksdag: { area: electionFor("riksdag", area.election.level, area.election.code), ref: electionFor("riksdag", "stad") },
    kommun: { area: electionFor("kommun", area.election.level, area.election.code), ref: electionFor("kommun", "stad") },
  };
  return (
    <Card
      id="val"
      title={`Valresultat ${ELECTION_YEAR}`}
      subtitle={`Hur invånarna i ${area.name} röstade, jämfört med hela Stockholm.`}
      source={`Valmyndigheten, slutligt antal röster per valdistrikt ${ELECTION_YEAR}. Valdistrikten följer inte SCB:s områden, så rösterna är fördelade efter hur stor del av distriktets yta som ligger i området. Valdeltagandet räknas på röster som kan knytas till ett valdistrikt; sent räknade röster ingår bara i Stockholms partifördelning.`}
    >
      <ElectionChart parties={PARTIES} name={area.name} refName="Stockholm" data={data} />
    </Card>
  );
}
