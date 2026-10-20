"use client";

import { useState } from "react";

export type SchoolRow = {
  code: string;
  name: string;
  kind: string;
  owner: string;
  web: string | null;
  merit9: number | null;
  meritSuppressed: boolean;
  eligible9: number | null;
  certifiedTeachers: number | null;
  studentsPerTeacher: number | null;
  pupils: number | null;
};

const num = (v: number | null, d = 0) => (v == null ? "–" : v.toLocaleString("sv-SE", { maximumFractionDigits: d, minimumFractionDigits: d }));

export default function SchoolTable({ rows }: { rows: SchoolRow[] }) {
  const [kind, setKind] = useState<"grundskola" | "gymnasium">("grundskola");
  const [all, setAll] = useState(false);
  const list = rows
    .filter((r) => r.kind === kind)
    .sort((a, b) => (b.merit9 ?? -1) - (a.merit9 ?? -1) || a.name.localeCompare(b.name, "sv"));
  const visible = all ? list : list.slice(0, 12);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="Skolform">
        {(["grundskola", "gymnasium"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`rounded-full border px-3 py-1 text-sm ${kind === k ? "border-accent bg-accent-soft font-medium" : "border-line hover:border-accent"}`}
          >
            {k === "grundskola" ? "Grundskolor" : "Gymnasier"} ({rows.filter((r) => r.kind === k).length})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-ink-2">Inga skolor av den typen i området.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-2">
                <th className="py-2 font-medium">Skola</th>
                <th className="py-2 font-medium">Huvudman</th>
                {kind === "grundskola" && <th className="py-2 text-right font-medium">Meritvärde åk 9</th>}
                {kind === "grundskola" && <th className="py-2 text-right font-medium">Behöriga gymn.</th>}
                <th className="py-2 text-right font-medium">Legitimerade lärare</th>
                <th className="py-2 text-right font-medium">Elever/lärare</th>
                <th className="py-2 text-right font-medium">Elever</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.code} className="border-b border-line last:border-0">
                  <td className="py-2">
                    {r.web ? (
                      <a href={r.web} target="_blank" rel="noreferrer" className="text-accent hover:underline">{r.name}</a>
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="py-2 text-ink-2">{r.owner}</td>
                  {kind === "grundskola" && (
                    <td className="tabular py-2 text-right" title={r.meritSuppressed ? "För få elever för att redovisas" : undefined}>
                      {r.meritSuppressed ? "för få elever" : num(r.merit9)}
                    </td>
                  )}
                  {kind === "grundskola" && <td className="tabular py-2 text-right">{r.eligible9 == null ? "–" : `${num(r.eligible9)} %`}</td>}
                  <td className="tabular py-2 text-right">{r.certifiedTeachers == null ? "–" : `${num(r.certifiedTeachers)} %`}</td>
                  <td className="tabular py-2 text-right">{num(r.studentsPerTeacher, 1)}</td>
                  <td className="tabular py-2 text-right">{num(r.pupils)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > visible.length && (
        <button onClick={() => setAll(true)} className="self-start text-sm text-accent hover:underline">
          Visa alla {list.length}
        </button>
      )}
      <p className="text-xs text-muted">
        Meritvärdet visas bara för skolor med årskurs 9. &quot;–&quot; betyder att uppgiften saknas eller att skolan inte har
        den årskursen.
      </p>
    </div>
  );
}
