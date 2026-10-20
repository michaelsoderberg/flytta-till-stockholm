"use client";

import Link from "next/link";
import { useState } from "react";

export type Column = { key: string; label: string };
export type Row = { id: string; name: string; href: string; values: Record<string, number | null>; display: Record<string, string> };

export default function SortableTable({
  columns,
  rows,
  reference,
  highlight,
  initialSort,
}: {
  columns: Column[];
  rows: Row[];
  reference?: { name: string; display: Record<string, string> };
  highlight?: string;
  initialSort: string;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: initialSort, desc: true });
  const sorted = [...rows].sort((a, b) => {
    if (sort.key === "name") return (sort.desc ? -1 : 1) * a.name.localeCompare(b.name, "sv");
    const x = a.values[sort.key] ?? -Infinity;
    const y = b.values[sort.key] ?? -Infinity;
    return sort.desc ? y - x : x - y;
  });
  const toggle = (key: string) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }));
  const arrow = (key: string) => (sort.key === key ? (sort.desc ? " ↓" : " ↑") : "");

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[760px] whitespace-nowrap text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="p-3">
              <button onClick={() => toggle("name")} className="font-medium text-ink-2 hover:text-ink">
                Stadsdelsområde{arrow("name")}
              </button>
            </th>
            {columns.map((c) => (
              <th key={c.key} className="p-3 text-right" aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"}>
                <button onClick={() => toggle(c.key)} className="font-medium text-ink-2 hover:text-ink">
                  {c.label}
                  {arrow(c.key)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className={`border-t border-line ${r.id === highlight ? "bg-accent-soft" : ""}`}>
              <td className="p-3">
                <Link href={r.href} className="font-medium hover:text-accent">{r.name}</Link>
              </td>
              {columns.map((c) => (
                <td key={c.key} className="tabular p-3 text-right">{r.display[c.key]}</td>
              ))}
            </tr>
          ))}
          {reference && (
            <tr className="border-t border-line bg-page text-muted">
              <td className="p-3">{reference.name}</td>
              {columns.map((c) => (
                <td key={c.key} className="tabular p-3 text-right">{reference.display[c.key]}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
