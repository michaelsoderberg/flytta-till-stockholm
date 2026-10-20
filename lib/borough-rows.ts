import { crimeFor } from "@/lib/crime";
import { electionFor, floodFor, natureFor, schoolsIn, weightedSchoolMean } from "@/lib/local";
import { METRICS, metricValue, type MetricExtras, type MetricKey } from "@/lib/metrics";
import { boroughStats, type AreaStats } from "@/lib/profile";
import { ALL_DESOS, desosInBorough } from "@/lib/stockholm";

function extras(region: string, desos: string[]): MetricExtras {
  const vote = region === "stockholm" ? electionFor("riksdag", "stad") : electionFor("riksdag", "borough", region);
  const schools = schoolsIn(desos).schools.filter((s) => s.kind === "grundskola");
  return {
    crimePer100k: crimeFor(region, "totalt")?.per100k ?? null,
    greenShare: natureFor(desos).greenShare,
    floodShare: floodFor(desos).share,
    merit: weightedSchoolMean(schools, "merit9"),
    turnout: vote && vote.eligible ? vote.cast / vote.eligible : null,
  };
}

/** All metrics for every borough and for the city as a whole. */
export async function boroughRows() {
  const { stad, boroughs, data } = await boroughStats();
  const values = (s: AreaStats, region: string, desos: string[]) => {
    const x = extras(region, desos);
    return Object.fromEntries(METRICS.map((m) => [m.key, metricValue(m.key, s, x)])) as Record<MetricKey, number | null>;
  };
  return {
    data,
    stadStats: stad,
    boroughs,
    stad: values(stad, "stockholm", ALL_DESOS),
    rows: boroughs.map(({ borough, stats }) => ({ id: borough.id, name: borough.name, values: values(stats, borough.id, desosInBorough(borough.id)) })),
  };
}
