"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { formatMetric, METRICS, type MetricKey } from "@/lib/metrics";

import { RAMP } from "@/lib/ramp";

const BoroughMap = dynamic(() => import("./BoroughMap"), {
  ssr: false,
  loading: () => <div className="h-[440px] w-full animate-pulse rounded-xl border border-line bg-surface" />,
});

export type ExplorerRow = { id: string; name: string; values: Record<MetricKey, number | null> };

export default function BoroughExplorer({
  geojson,
  rows,
  stad,
}: {
  geojson: FeatureCollection;
  rows: ExplorerRow[];
  stad: Record<MetricKey, number | null>;
}) {
  const [metric, setMetric] = useState<MetricKey>("brott");
  const [hover, setHover] = useState<string | null>(null);
  const def = METRICS.find((m) => m.key === metric)!;

  const values = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r.values[metric]])), [rows, metric]);
  const labels = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, `${def.short}: ${formatMetric(r.values[metric], def.format)}`])),
    [rows, metric, def],
  );
  const sorted = [...rows].sort((a, b) => (b.values[metric] ?? -Infinity) - (a.values[metric] ?? -Infinity));
  const nums = rows.map((r) => r.values[metric]).filter((v): v is number => v != null);
  const min = Math.min(...nums);
  const max = Math.max(...nums);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Välj mått">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            aria-pressed={metric === m.key}
            className={`rounded-full border px-3 py-1 text-sm ${metric === m.key ? "border-accent bg-accent-soft font-medium" : "border-line bg-surface hover:border-accent"}`}
          >
            {m.short}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BoroughMap geojson={geojson} values={values} labels={labels} highlight={hover} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <div className="flex items-center gap-2" aria-label="Färgskala">
              <span className="tabular">{formatMetric(min, def.format)}</span>
              <span className="flex">
                {RAMP.map((c) => (
                  <span key={c} className="h-3 w-6 first:rounded-l last:rounded-r" style={{ background: c }} />
                ))}
              </span>
              <span className="tabular">{formatMetric(max, def.format)}</span>
            </div>
            <span>Klicka på ett område för att se mer.</span>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 lg:col-span-2">
          <h3 className="text-sm font-medium">{def.label}</h3>
          <p className="mb-3 text-xs text-muted">Hela Stockholm: {formatMetric(stad[metric], def.format)}</p>
          <ol className="flex flex-col gap-1.5">
            {sorted.map((r, i) => {
              const v = r.values[metric];
              return (
                <li key={r.id}>
                  <Link
                    href={`/stadsdel/${r.id}`}
                    onMouseEnter={() => setHover(r.id)}
                    onMouseLeave={() => setHover(null)}
                    className="group grid grid-cols-[1.25rem_minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm"
                  >
                    <span className="tabular text-xs text-muted">{i + 1}</span>
                    <span className="truncate group-hover:text-accent">{r.name}</span>
                    <span className="h-2.5 rounded-full bg-grid">
                      <span
                        className="block h-2.5 rounded-full bg-accent"
                        style={{ width: `${v != null && max ? (v / max) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="tabular w-20 text-right">{formatMetric(v, def.format)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
