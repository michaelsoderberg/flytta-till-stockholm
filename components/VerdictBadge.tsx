import type { Verdict } from "@/lib/compare";

export default function VerdictBadge({ verdict, reference = "riket" }: { verdict: Verdict; reference?: string }) {
  if (verdict === "neutral") return null;
  const s = {
    better: { icon: "▲", text: `Bättre än ${reference}`, className: "text-good" },
    worse: { icon: "▼", text: `Sämre än ${reference}`, className: "text-bad" },
    similar: { icon: "●", text: `Som ${reference}`, className: "text-ink-2" },
  }[verdict];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium ${s.className}`}>
      <span aria-hidden>{s.icon}</span>
      {s.text}
    </span>
  );
}
