import Card from "@/components/Card";
import TrendLine, { type TrendFormat } from "@/components/charts/TrendLine";
import type { TrendPoint } from "@/lib/trends";

type Key = "population" | "meanIncome" | "rentalShare" | "childrenShare";

const CHARTS: { key: Key; title: string; format: TrendFormat; index?: boolean }[] = [
  { key: "population", title: "Befolkning, index (2015 = 100)", format: "index", index: true },
  { key: "meanIncome", title: "Ekonomisk standard, snitt (fasta priser)", format: "tkr" },
  { key: "rentalShare", title: "Andel som bor i hyresrätt", format: "pct" },
  { key: "childrenShare", title: "Andel barn och unga (0–19 år)", format: "pct" },
];

function series(points: TrendPoint[], key: Key, index: boolean) {
  const base = points.find((p) => p[key] != null)?.[key] ?? null;
  return points.map((p) => {
    const v = p[key];
    return v == null ? null : index && base ? (v / base) * 100 : v;
  });
}

function change(points: TrendPoint[], key: Key) {
  const withValue = points.filter((p) => p[key] != null);
  if (withValue.length < 2) return null;
  const first = withValue[0];
  const last = withValue.at(-1)!;
  return { from: first.year, to: last.year, first: first[key]!, last: last[key]! };
}

function describe(points: TrendPoint[], key: Key, format: TrendFormat) {
  const c = change(points, key);
  if (!c) return null;
  if (format === "pct") {
    const pp = (c.last - c.first) * 100;
    return `${pp >= 0 ? "+" : "−"}${Math.abs(pp).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} procentenheter ${c.from}–${c.to}`;
  }
  const rel = ((c.last - c.first) / c.first) * 100;
  return `${rel >= 0 ? "+" : "−"}${Math.abs(rel).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} % ${c.from}–${c.to}`;
}

export default function TrendsCard({
  name,
  points,
  reference,
}: {
  name: string;
  points: TrendPoint[];
  reference: { name: string; points: TrendPoint[] };
}) {
  return (
    <Card
      id="utveckling"
      title="Utveckling över tid"
      subtitle={`Hur ${name} har förändrats sedan 2015, jämfört med ${reference.name}.`}
      source="SCB. Åren t.o.m. 2023 bygger på SCB:s DeSO-indelning från 2018 och senare år på 2025 års indelning, så små hopp mellan 2023 och 2024 kan bero på ändrade gränser. Inkomståret 2021 påverkas av ovanligt höga kapitalinkomster."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {CHARTS.map((c) => {
          const a = series(points, c.key, !!c.index);
          const b = series(reference.points, c.key, !!c.index);
          const data = points.map((p, i) => ({ year: p.year, a: a[i], b: b[i] ?? null })).filter((d) => d.a != null || d.b != null);
          const text = describe(points, c.key, c.format);
          return (
            <div key={c.key}>
              <h3 className="text-sm font-medium">{c.title}</h3>
              {text && <p className="text-xs text-muted">{name}: {text}</p>}
              <TrendLine data={data} nameA={name} nameB={reference.name} format={c.format} height={200} zeroBased={c.format !== "index"} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
