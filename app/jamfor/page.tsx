import SortableTable from "@/components/SortableTable";
import { boroughRows } from "@/lib/borough-rows";
import { CRIME_CATEGORIES, crimeFor, LATEST_CRIME_YEAR } from "@/lib/crime";
import { formatMetric, METRICS } from "@/lib/metrics";

export const metadata = { title: "Jämför stadsdelsområden – Kommunkollen Stockholm" };
export const revalidate = 86400;

const int = (v: number | null | undefined) => (v == null ? "–" : Math.round(v).toLocaleString("sv-SE"));

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ markera?: string }> }) {
  const { markera } = await searchParams;
  const { rows, stad } = await boroughRows();

  const peopleColumns = METRICS.filter((m) => m.key !== "brott").map((m) => ({ key: m.key, label: m.short }));
  const peopleRows = rows.map((r) => ({
    id: r.id,
    name: r.name,
    href: `/stadsdel/${r.id}`,
    values: r.values,
    display: Object.fromEntries(METRICS.map((m) => [m.key, formatMetric(r.values[m.key], m.format)])),
  }));
  const stadDisplay = Object.fromEntries(METRICS.map((m) => [m.key, formatMetric(stad[m.key], m.format)]));

  const crimeColumns = CRIME_CATEGORIES.map((c) => ({ key: c.key, label: c.key === "totalt" ? "Totalt" : c.label }));
  const crimeRow = (id: string) => Object.fromEntries(CRIME_CATEGORIES.map((c) => [c.key, crimeFor(id, c.key)?.per100k ?? null]));
  const crimeRows = rows.map((r) => {
    const values = crimeRow(r.id);
    return { id: r.id, name: r.name, href: `/stadsdel/${r.id}`, values, display: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, int(v)])) };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Jämför stadsdelsområden</h1>
        <p className="mt-1 text-ink-2">Klicka på en kolumnrubrik för att sortera.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Vilka bor där?</h2>
        <SortableTable columns={peopleColumns} rows={peopleRows} reference={{ name: "Hela Stockholm", display: stadDisplay }} highlight={markera} initialSort="inkomst" />
        <p className="text-xs text-muted">Källa: SCB, summerat från DeSO-områden. Ekonomisk standard är ett genomsnitt per person.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Anmälda brott per 100 000 invånare ({LATEST_CRIME_YEAR})</h2>
        <SortableTable
          columns={crimeColumns}
          rows={crimeRows}
          reference={{ name: "Hela Stockholm", display: Object.fromEntries(Object.entries(crimeRow("stockholm")).map(([k, v]) => [k, int(v)])) }}
          highlight={markera}
          initialSort="totalt"
        />
        <p className="text-xs text-muted">
          Källa: Brå. Brott räknas där de begicks men delas med antalet invånare, så områden med många besökare (som city) får höga tal.
        </p>
      </section>
    </div>
  );
}
