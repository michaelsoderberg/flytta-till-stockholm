"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrendDatum = { year: number; a: number | null; b: number | null };
export type TrendFormat = "int" | "pct" | "index" | "tkr";

const formatters: Record<TrendFormat, (v: number) => string> = {
  int: (v) => Math.round(v).toLocaleString("sv-SE"),
  pct: (v) => `${(v * 100).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`,
  index: (v) => v.toLocaleString("sv-SE", { maximumFractionDigits: 1 }),
  tkr: (v) => `${Math.round(v).toLocaleString("sv-SE")} tkr`,
};

export default function TrendLine({
  data,
  nameA,
  nameB,
  format = "int",
  height = 256,
  zeroBased = true,
}: {
  data: TrendDatum[];
  nameA: string;
  nameB: string;
  format?: TrendFormat;
  height?: number;
  zeroBased?: boolean;
}) {
  const fmt = formatters[format];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="year" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={{ stroke: "var(--axis)" }} tickLine={false} />
          <YAxis
            tickFormatter={(v: number) => (format === "pct" ? `${Math.round(v * 100)} %` : fmt(v))}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={format === "tkr" ? 64 : 56}
            domain={zeroBased ? [0, "auto"] : ["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--ink)" }}
            formatter={(v) => fmt(Number(v))}
          />
          <Legend itemSorter={null} wrapperStyle={{ fontSize: 13, color: "var(--ink-2)" }} iconType="circle" />
          <Line isAnimationActive={false} type="monotone" dataKey="a" name={nameA} stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
          <Line isAnimationActive={false} type="monotone" dataKey="b" name={nameB} stroke="var(--reference)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
