import Link from "next/link";
import { notFound } from "next/navigation";
import type { FeatureCollection, Geometry } from "geojson";
import AreaMap from "@/components/AreaMapLazy";
import Card from "@/components/Card";
import ComparisonBars from "@/components/charts/ComparisonBars";
import TrendLine from "@/components/charts/TrendLine";
import PoliceEvents from "@/components/PoliceEvents";
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
import VerdictBadge from "@/components/VerdictBadge";
import boroughGeo from "@/data/stockholm/boroughs.geojson.json";
import { verdict } from "@/lib/compare";
import { CRIME_CATEGORIES, crimeFor, crimeTrend, LATEST_CRIME_YEAR } from "@/lib/crime";
import { placeEvent } from "@/lib/police-areas";
import { collectIfStale, getStockholmCollectionStart, getStockholmEvents } from "@/lib/polisen";
import { boroughRef, loadStockholm, neighbourhoodRef, stadRef, stats, summarize } from "@/lib/profile";
import { BOROUGHS, desosInBorough, getBorough, neighbourhoodsInBorough, titleCase } from "@/lib/stockholm";
import { boroughTrendRef, loadTrends, stadTrendRef, trendFor } from "@/lib/trends";

export const revalidate = 600;

export function generateStaticParams() {
  return BOROUGHS.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const b = getBorough((await params).id);
  return { title: b ? `${b.name} – Kommunkollen Stockholm` : "Kommunkollen" };
}

const fmt = (v: number | null | undefined) => (v == null ? "–" : Math.round(v).toLocaleString("sv-SE"));
const pct = (v: number) => `${Math.round(v * 100)} %`;

export default async function BoroughPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const borough = getBorough(id);
  if (!borough) notFound();

  const [data, trendTables] = await Promise.all([loadStockholm(), loadTrends(), collectIfStale()]);
  const a = stats(data, boroughRef(id));
  const stad = stats(data, stadRef());
  const geometry = (boroughGeo as unknown as FeatureCollection).features.find((f) => f.properties?.id === id)!
    .geometry as Geometry;

  // Crime
  const total = crimeFor(id, "totalt");
  const stadTotal = crimeFor("stockholm", "totalt");
  const rank =
    BOROUGHS.map((b) => ({ id: b.id, v: crimeFor(b.id, "totalt")?.per100k ?? Infinity }))
      .sort((x, y) => x.v - y.v)
      .findIndex((x) => x.id === id) + 1;
  const crimeBars = CRIME_CATEGORIES.filter((c) => c.key !== "totalt").map((c) => ({
    label: c.label,
    a: crimeFor(id, c.key)?.per100k ?? null,
    b: crimeFor("stockholm", c.key)?.per100k ?? null,
  }));
  const trend = crimeTrend(id, "totalt").map((p, i) => ({ year: p.year, a: p.value, b: crimeTrend("stockholm", "totalt")[i].value }));

  // Police events placed in this borough by the places their text mentions
  const allEvents = getStockholmEvents(365).map(placeEvent);
  const events = allEvents.filter((e) => e.borough === id);
  const placedShare = allEvents.length ? allEvents.filter((e) => e.borough).length / allEvents.length : 0;

  const neighbourhoods = neighbourhoodsInBorough(id)
    .map((n) => ({ n, s: stats(data, neighbourhoodRef(n.code)) }))
    .sort((x, y) => y.s.population - x.s.population);

  const local: LocalArea = {
    name: borough.name,
    desos: desosInBorough(id),
    boroughId: id,
    geometry,
    center: geometryCenter(geometry),
    stats: a,
    stadStats: stad,
    election: { level: "borough", code: id },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            <Link href="/" className="hover:text-accent">Stockholm</Link> · Stadsdelsområde
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{borough.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            Stadsdelar: {borough.stadsdelar.map(titleCase).sort((x, y) => x.localeCompare(y, "sv")).join(", ")}
          </p>
        </div>
        <Link href={`/jamfor?markera=${id}`} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-accent">
          Jämför alla stadsdelsområden
        </Link>
      </div>

      <SectionNav
        sections={[
          { id: "oversikt", label: "Översikt" },
          { id: "karta", label: "Karta" },
          { id: "utveckling", label: "Utveckling" },
          { id: "brott", label: "Brott" },
          { id: "polisen", label: "Polisen" },
          { id: "skolor", label: "Skolor" },
          { id: "service", label: "Service" },
          { id: "natur", label: "Natur" },
          { id: "oversvamning", label: "Översvämning" },
          { id: "bostader", label: "Bostäder" },
          { id: "val", label: "Val" },
          { id: "grannskap", label: "Grannskap" },
          { id: "befolkning", label: "Befolkning" },
        ]}
      />

      <div id="oversikt" className="grid scroll-mt-16 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Summary
            lines={summarize(a, stad, "Stockholm")}
            source={`SCB, summerat över stadsdelsområdets ${boroughRef(id).scb.length} DeSO-områden (befolkning ${data.years.befolkning}, inkomst ${data.years.inkomst}).`}
          />
        </div>
        <div className="lg:col-span-2">
          <AreaMap geometry={geometry} />
        </div>
      </div>

      <ProfileTiles a={a} refs={[{ name: "Stockholm", stats: stad }]} />

      <MapCard area={local} />

      <TrendsCard
        name={borough.name}
        points={trendFor(trendTables, boroughTrendRef(id))}
        reference={{ name: "Stockholm", points: trendFor(trendTables, stadTrendRef()) }}
      />

      <Card
        id="brott"
        title="Anmälda brott"
        subtitle={
          total && stadTotal ? (
            <>
              {LATEST_CRIME_YEAR}: <strong>{fmt(total.per100k)}</strong> anmälda brott per 100 000 invånare ({fmt(total.count)} brott),
              Stockholm {fmt(stadTotal.per100k)}. <strong>{rank}:e lägst</strong> av 11 stadsdelsområden.{" "}
              <VerdictBadge verdict={verdict(total.per100k, stadTotal.per100k, false)} reference="Stockholm" />
            </>
          ) : (
            "Ingen brottsstatistik tillgänglig."
          )
        }
        source="Brå, statistikdatabasen över anmälda brott. Brotten räknas där de begicks, men per invånare – i områden med många besökare (t.ex. city) blir talen därför höga. För åren före 2024 är Järva och Norra innerstaden summerade från tidigare stadsdelsområden."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-2">Per brottstyp, antal per 100 000 invånare ({LATEST_CRIME_YEAR})</h3>
            <ComparisonBars data={crimeBars} nameA={borough.name} nameB="Stockholm" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-2">Brott totalt per 100 000 invånare över tid</h3>
            <TrendLine data={trend} nameA={borough.name} nameB="Stockholm" />
          </div>
        </div>
      </Card>

      <Card
        id="polisen"
        title="Polisens händelser"
        subtitle={`Händelser i Stockholm där Polisens text nämner en plats i ${borough.name}, t.ex. en stadsdel, ett torg eller en park.`}
        source="Polisen (polisen.se/api/events)"
      >
        <PoliceEvents
          events={events}
          collectionStart={getStockholmCollectionStart()}
          note={`Polisen anger bara "Stockholm" som plats. Kommunkollen kan placera ${pct(placedShare)} av händelserna utifrån texten; övriga räknas inte här.`}
        />
      </Card>

      <SchoolsCard area={local} />
      <ServicesCard area={local} />
      <NatureCard area={local} />
      <FloodCard area={local} />
      <HousingCard area={local} />
      <ElectionsCard area={local} />

      <Card id="grannskap" title="Grannskap" subtitle={`SCB:s regionala statistikområden (RegSO) i ${borough.name}.`} source="SCB">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-2">
                <th className="py-2 font-medium">Grannskap</th>
                <th className="py-2 text-right font-medium">Invånare</th>
                <th className="py-2 text-right font-medium">Median ek. standard</th>
                <th className="py-2 text-right font-medium">Hyresrätt</th>
                <th className="py-2 text-right font-medium">Eftergymn.</th>
              </tr>
            </thead>
            <tbody>
              {neighbourhoods.map(({ n, s }) => (
                <tr key={n.code} className="border-b border-line last:border-0">
                  <td className="py-2">
                    <Link href={`/omrade/${n.code}`} className="text-accent hover:underline">{n.name}</Link>
                  </td>
                  <td className="tabular py-2 text-right">{fmt(s.population)}</td>
                  <td className="tabular py-2 text-right">{fmt(s.medianIncome)} tkr</td>
                  <td className="tabular py-2 text-right">{pct(s.rentalShare)}</td>
                  <td className="tabular py-2 text-right">{pct(s.higherEducationShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div id="befolkning" className="scroll-mt-16">
        <ProfileCharts a={a} nameA={borough.name} reference={{ name: "Stockholm", stats: stad }} />
      </div>
    </div>
  );
}
