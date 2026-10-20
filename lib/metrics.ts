import type { AreaStats } from "@/lib/profile";

export type MetricKey =
  | "brott"
  | "inkomst"
  | "utbildning"
  | "sysselsattning"
  | "hyresratt"
  | "barnfamiljer"
  | "medelalder"
  | "bilar"
  | "befolkning"
  | "gron"
  | "oversvamning"
  | "meritvarde"
  | "valdeltagande";

export type MetricDef = { key: MetricKey; label: string; short: string; format: "pct" | "int" | "tkr" | "years" };

export const METRICS: MetricDef[] = [
  { key: "brott", label: "Anmälda brott per 100 000 invånare", short: "Brott/100k", format: "int" },
  { key: "inkomst", label: "Ekonomisk standard, genomsnitt (tkr/år)", short: "Ek. standard", format: "tkr" },
  { key: "utbildning", label: "Eftergymnasial utbildning, 25–65 år", short: "Eftergymn.", format: "pct" },
  { key: "sysselsattning", label: "Förvärvsarbetande, 20–64 år", short: "Förvärvsarb.", format: "pct" },
  { key: "hyresratt", label: "Bor i hyresrätt", short: "Hyresrätt", format: "pct" },
  { key: "barnfamiljer", label: "Hushåll med barn", short: "Barnhushåll", format: "pct" },
  { key: "medelalder", label: "Medelålder (uppskattad)", short: "Medelålder", format: "years" },
  { key: "bilar", label: "Bilar i trafik per 1 000 invånare", short: "Bilar/1000", format: "int" },
  { key: "befolkning", label: "Invånare", short: "Invånare", format: "int" },
  { key: "gron", label: "Grönområden av landytan", short: "Grönt", format: "pct" },
  { key: "oversvamning", label: "Mark med stående vatten vid 100-årsregn", short: "Skyfall", format: "pct" },
  { key: "meritvarde", label: "Meritvärde åk 9 i områdets skolor (viktat)", short: "Meritvärde", format: "int" },
  { key: "valdeltagande", label: "Valdeltagande riksdagsvalet 2026", short: "Valdeltag.", format: "pct" },
];

/** Values that come from other sources than SCB's population statistics. */
export type MetricExtras = {
  crimePer100k: number | null;
  greenShare: number | null;
  floodShare: number | null;
  merit: number | null;
  turnout: number | null;
};

export function metricValue(key: MetricKey, s: AreaStats, x: MetricExtras): number | null {
  switch (key) {
    case "brott":
      return x.crimePer100k;
    case "gron":
      return x.greenShare;
    case "oversvamning":
      return x.floodShare;
    case "meritvarde":
      return x.merit;
    case "valdeltagande":
      return x.turnout;
    case "inkomst":
      return s.meanIncome;
    case "utbildning":
      return s.higherEducationShare;
    case "sysselsattning":
      return s.employmentRate;
    case "hyresratt":
      return s.rentalShare;
    case "barnfamiljer":
      return s.familiesWithChildrenShare;
    case "medelalder":
      return s.averageAge;
    case "bilar":
      return s.carsPer1000;
    case "befolkning":
      return s.population;
  }
}

export function formatMetric(value: number | null | undefined, format: MetricDef["format"]): string {
  if (value == null) return "–";
  switch (format) {
    case "pct":
      return `${Math.round(value * 100)} %`;
    case "tkr":
      return `${Math.round(value).toLocaleString("sv-SE")} tkr`;
    case "years":
      return `${Math.round(value)} år`;
    default:
      return Math.round(value).toLocaleString("sv-SE");
  }
}
