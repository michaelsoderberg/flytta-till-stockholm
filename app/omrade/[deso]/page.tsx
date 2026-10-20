import Link from "next/link";
import { notFound } from "next/navigation";
import AreaMap from "@/components/AreaMapLazy";
import { ProfileCharts, ProfileTiles, Summary } from "@/components/ProfileSections";
import TrendsCard from "@/components/TrendsCard";
import SectionNav from "@/components/SectionNav";
import {
  ElectionsCard,
  FloodCard,
  HousingCard,
  type LocalArea,
  MapCard,
  NatureCard,
  SchoolsCard,
  ServicesCard,
} from "@/components/LocalSections";
import { geometryCenter } from "@/lib/geometry";
import { optional } from "@/lib/http";
import { desoByCode, regsoGeometry } from "@/lib/deso";
import { boroughRef, desoRef, loadStockholm, neighbourhoodRef, stadRef, stats, summarize } from "@/lib/profile";
import {
  boroughForDeso,
  getBorough,
  getNeighbourhood,
  isDesoCode,
  isNeighbourhoodCode,
  neighbourhoodForDeso,
} from "@/lib/stockholm";
import { boroughTrendRef, loadTrends, neighbourhoodTrendRef, trendFor } from "@/lib/trends";

export const revalidate = 86400;

/** Resolves a RegSO (grannskap) or DeSO code to what the page needs. */
async function resolve(code: string) {
  if (isNeighbourhoodCode(code)) {
    const n = getNeighbourhood(code);
    const geometry = n && (await regsoGeometry(code));
    if (!n || !geometry) return null;
    return { kind: "grannskap" as const, name: n.name, ref: neighbourhoodRef(code), borough: getBorough(n.borough)!, neighbourhood: n, geometry };
  }
  if (isDesoCode(code)) {
    const borough = boroughForDeso(code);
    const feature = borough && (await desoByCode(code));
    if (!borough || !feature) return null;
    const n = neighbourhoodForDeso(code);
    return { kind: "deso" as const, name: n?.name ?? `Område ${code}`, ref: desoRef(code), borough, neighbourhood: n, geometry: feature.geometry };
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ deso: string }> }) {
  const code = (await params).deso;
  const n = isNeighbourhoodCode(code) ? getNeighbourhood(code) : neighbourhoodForDeso(code);
  return { title: `Vilka bor i ${n?.name ?? code}? – Kommunkollen Stockholm` };
}

export default async function AreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ deso: string }>;
  searchParams: Promise<{ adress?: string }>;
}) {
  const { deso: code } = await params;
  const { adress } = await searchParams;
  const area = await resolve(code);
  if (!area) notFound();

  // Trends are optional: if SCB's trend tables fail, the page renders without that section.
  const [data, trendTables] = await Promise.all([loadStockholm(), optional(loadTrends(), "SCB trends")]);
  const a = stats(data, area.ref);
  const b = stats(data, boroughRef(area.borough.id));
  const stad = stats(data, stadRef());

  // Local services are shown for the whole neighbourhood, also on a DeSO page.
  const n = area.neighbourhood;
  const local: LocalArea = {
    name: n?.name ?? area.name,
    desos: n?.desos ?? [code],
    boroughId: area.borough.id,
    geometry: area.geometry,
    center: geometryCenter(area.geometry),
    stats: n ? stats(data, neighbourhoodRef(n.code)) : a,
    stadStats: stad,
    election: { level: "regso", code: n?.code ?? "" },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            <Link href="/" className="hover:text-accent">Stockholm</Link> ·{" "}
            <Link href={`/stadsdel/${area.borough.id}`} className="hover:text-accent">{area.borough.name}</Link>
            {area.kind === "deso" && area.neighbourhood && (
              <>
                {" · "}
                <Link href={`/omrade/${area.neighbourhood.code}`} className="hover:text-accent">{area.neighbourhood.name}</Link>
              </>
            )}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Vilka bor i {area.name}?</h1>
          <p className="mt-1 text-sm text-ink-2">
            {adress ? `Området runt ${adress}. ` : ""}
            {area.kind === "deso"
              ? `DeSO ${code}: ett av SCB:s minsta statistikområden (700–2 700 invånare).`
              : `Grannskap (RegSO ${code}) med ${area.neighbourhood?.desos.length} DeSO-områden.`}
          </p>
        </div>
        <Link href={`/stadsdel/${area.borough.id}`} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-accent">
          {area.borough.name}: brott och polishändelser
        </Link>
      </div>

      <SectionNav
        sections={[
          { id: "oversikt", label: "Översikt" },
          { id: "karta", label: "Karta" },
          { id: "utveckling", label: "Utveckling" },
          { id: "skolor", label: "Skolor" },
          { id: "service", label: "Service" },
          { id: "natur", label: "Natur" },
          { id: "oversvamning", label: "Översvämning" },
          { id: "bostader", label: "Bostäder" },
          { id: "val", label: "Val" },
          { id: "befolkning", label: "Befolkning" },
        ]}
      />

      <div id="oversikt" className="grid scroll-mt-16 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Summary
            lines={summarize(a, b, area.borough.name)}
            source={`SCB (befolkning ${data.years.befolkning}, inkomst ${data.years.inkomst}). Jämförelsen gäller stadsdelsområdet ${area.borough.name}.`}
          />
        </div>
        <div className="lg:col-span-2">
          <AreaMap geometry={area.geometry} />
        </div>
      </div>

      <ProfileTiles
        a={a}
        refs={[
          { name: area.borough.name, stats: b },
          { name: "Stockholm", stats: stad },
        ]}
      />

      <MapCard area={local} />

      {area.neighbourhood && trendTables && (
        <TrendsCard
          name={area.neighbourhood.name}
          points={trendFor(trendTables, neighbourhoodTrendRef(area.neighbourhood.code))}
          reference={{ name: area.borough.name, points: trendFor(trendTables, boroughTrendRef(area.borough.id)) }}
        />
      )}

      <SchoolsCard area={local} />
      <ServicesCard area={local} />
      <NatureCard area={local} />
      <FloodCard area={local} />
      <HousingCard area={local} />
      {n && <ElectionsCard area={local} />}

      <div id="befolkning" className="scroll-mt-16">
        <ProfileCharts a={a} nameA={area.name} reference={{ name: area.borough.name, stats: b }} />
      </div>

      <p className="text-xs text-muted">
        Från och med 2025 lägger SCB till en liten slumpmässig osäkerhet i statistiken för att skydda enskilda personer,
        så små tal och andelar kan avvika något. Medelåldern är uppskattad från åldersgrupper.
      </p>
    </div>
  );
}
