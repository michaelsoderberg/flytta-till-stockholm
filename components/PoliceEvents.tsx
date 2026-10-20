"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PoliceEvent } from "@/lib/polisen";

type Event = PoliceEvent & { place?: string | null };

const RANGES = [
  { days: 7, label: "7 dagar" },
  { days: 30, label: "30 dagar" },
  { days: 90, label: "90 dagar" },
  { days: 365, label: "1 år" },
];

const dateFmt = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

export default function PoliceEvents({
  events,
  collectionStart,
  note,
}: {
  events: Event[];
  collectionStart: string | null;
  note?: string;
}) {
  const [days, setDays] = useState(30);
  const [type, setType] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const inRange = useMemo(() => {
    const since = Date.now() - days * 86400_000;
    return events.filter((e) => Date.parse(e.datetime) >= since);
  }, [events, days]);

  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of inRange) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [inRange]);

  const listed = type ? inRange.filter((e) => e.type === type) : inRange;
  const visible = showAll ? listed : listed.slice(0, 15);
  const chartData = byType.slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`rounded-full border px-3 py-1 text-sm ${days === r.days ? "border-accent bg-accent-soft font-medium" : "border-line hover:border-accent"}`}
          >
            {r.label}
          </button>
        ))}
        <span className="text-sm text-ink-2">
          <strong className="text-ink">{inRange.length}</strong> händelser
        </span>
      </div>

      {chartData.length > 0 && (
        <div style={{ height: chartData.length * 32 + 40 }} className="w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="var(--grid)" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={{ stroke: "var(--axis)" }} tickLine={false} />
              <YAxis type="category" dataKey="label" width={170} tick={{ fill: "var(--ink-2)", fontSize: 13 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "var(--grid)", opacity: 0.4 }}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--ink)" }}
                formatter={(v) => [String(v), "Händelser"]}
              />
              <Bar
                isAnimationActive={false}
                dataKey="count"
                fill="var(--series-1)"
                radius={[0, 4, 4, 0]}
                maxBarSize={18}
                cursor="pointer"
                onClick={(d) => {
                  const label = (d.payload as { label?: string } | undefined)?.label ?? null;
                  setType(label === type ? null : label);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label htmlFor="type-filter" className="text-sm text-ink-2">Typ:</label>
          <select
            id="type-filter"
            value={type ?? ""}
            onChange={(e) => setType(e.target.value || null)}
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm"
          >
            <option value="">Alla typer</option>
            {byType.map((t) => (
              <option key={t.label} value={t.label}>
                {t.label} ({t.count})
              </option>
            ))}
          </select>
        </div>
        {listed.length === 0 ? (
          <p className="text-sm text-ink-2">Inga händelser under perioden.</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {e.type}
                    {e.place && <span className="ml-2 text-xs font-normal text-muted">{e.place}</span>}
                  </span>
                  <time className="tabular text-xs text-muted" dateTime={e.datetime}>
                    {dateFmt.format(new Date(e.datetime))}
                  </time>
                </div>
                <p className="mt-1 text-sm text-ink-2">{e.summary}</p>
                <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-accent hover:underline">
                  Läs mer på polisen.se
                </a>
              </li>
            ))}
          </ul>
        )}
        {listed.length > visible.length && (
          <button onClick={() => setShowAll(true)} className="mt-2 text-sm text-accent hover:underline">
            Visa alla {listed.length}
          </button>
        )}
      </div>

      <p className="text-xs text-muted">
        {note ? `${note} ` : ""}Polisens API visar bara de senaste 500 händelserna, så de sparas löpande
        {collectionStart ? ` (data sedan ${collectionStart.slice(0, 10)})` : ""}. Händelserna är preliminära.
      </p>
    </div>
  );
}
