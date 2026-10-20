"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ComparisonDatum = { label: string; a: number | null; b: number | null };

const fmt = (v: number, decimals: number, percent: boolean) =>
  percent
    ? `${(v * 100).toLocaleString("sv-SE", { maximumFractionDigits: decimals })} %`
    : v.toLocaleString("sv-SE", { maximumFractionDigits: decimals });

/** Horizontal bars comparing this place (a) with a reference (b), one row per category. */
export default function ComparisonBars({
  data,
  nameA,
  nameB,
  percent = false,
  decimals = 0,
}: {
  data: ComparisonDatum[];
  nameA: string;
  nameB: string;
  percent?: boolean;
  decimals?: number;
}) {
  const height = Math.max(160, data.length * 44 + 60);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => fmt(v, 0, percent)}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--axis)" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fill: "var(--ink-2)", fontSize: 13 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--grid)", opacity: 0.4 }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--ink)" }}
            formatter={(v) => fmt(Number(v), decimals, percent)}
          />
          <Legend itemSorter={null} wrapperStyle={{ fontSize: 13, color: "var(--ink-2)" }} iconType="circle" />
          <Bar isAnimationActive={false} dataKey="a" name={nameA} fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={14} />
          <Bar isAnimationActive={false} dataKey="b" name={nameB} fill="var(--reference)" radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
