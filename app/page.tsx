import type { FeatureCollection } from "geojson";
import BoroughExplorer from "@/components/BoroughExplorer";
import SearchBox from "@/components/SearchBox";
import boroughGeo from "@/data/stockholm/boroughs.geojson.json";
import { boroughRows } from "@/lib/borough-rows";
import { LATEST_CRIME_YEAR } from "@/lib/crime";
import { BOROUGHS, NEIGHBOURHOODS } from "@/lib/stockholm";

export const revalidate = 86400;

export default async function Home() {
  const { rows, stad, data } = await boroughRows();
  const places = [
    ...BOROUGHS.map((b) => ({ label: b.name, sub: "Stadsdelsområde", href: `/stadsdel/${b.id}` })),
    ...NEIGHBOURHOODS.map((n) => ({
      label: n.name,
      sub: BOROUGHS.find((b) => b.id === n.borough)?.name ?? "",
      href: `/omrade/${n.code}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-10">
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-5 pt-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Stockholm, stadsdel för stadsdel</h1>
        <p className="text-lg text-ink-2">
          Jämför Stockholms 11 stadsdelsområden och 127 grannskap: vilka som bor där, brott, skolor, service, natur,
          översvämningsrisk, bostäder och hur man röstade.
        </p>
        <SearchBox places={places} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Utforska stadsdelsområdena</h2>
        <BoroughExplorer geojson={boroughGeo as unknown as FeatureCollection} rows={rows} stad={stad} />
        <p className="text-xs text-muted">
          Källor: Brå (anmälda brott {LATEST_CRIME_YEAR}), SCB (befolkning {data.years.befolkning}, inkomst {data.years.inkomst}, grönområden),
          Skolverket, MCF (skyfall), Valmyndigheten (val 2026).
          Ekonomisk standard är disponibel inkomst per person justerad för hushållets storlek.
        </p>
      </section>
    </div>
  );
}
