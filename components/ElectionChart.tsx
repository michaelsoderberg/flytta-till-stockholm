"use client";

import { useState } from "react";
import ComparisonBars from "@/components/charts/ComparisonBars";
import type { Tally } from "@/lib/local";

type Party = { key: string; name: string };

export default function ElectionChart({
  parties,
  name,
  refName,
  data,
}: {
  parties: Party[];
  name: string;
  refName: string;
  data: Record<"riksdag" | "kommun", { area: Tally | null; ref: Tally | null }>;
}) {
  const [kind, setKind] = useState<"riksdag" | "kommun">("riksdag");
  const { area, ref } = data[kind];
  const share = (t: Tally | null, k: string) => (t && t.valid ? t.votes[k] / t.valid : null);
  const turnout = (t: Tally | null) => (t && t.eligible ? `${((t.cast / t.eligible) * 100).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %` : "–");
  const bars = parties.map((p) => ({ label: p.name, a: share(area, p.key), b: share(ref, p.key) }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Val">
        {(["riksdag", "kommun"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`rounded-full border px-3 py-1 text-sm ${kind === k ? "border-accent bg-accent-soft font-medium" : "border-line hover:border-accent"}`}
          >
            {k === "riksdag" ? "Riksdagsvalet" : "Kommunvalet"}
          </button>
        ))}
        <span className="text-sm text-ink-2">
          Valdeltagande: <strong className="text-ink">{turnout(area)}</strong> ({refName} {turnout(ref)})
        </span>
      </div>
      <ComparisonBars data={bars} nameA={name} nameB={refName} percent decimals={1} />
    </div>
  );
}
