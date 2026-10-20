import Card from "@/components/Card";
import ComparisonBars from "@/components/charts/ComparisonBars";
import type { AreaStats, Share } from "@/lib/profile";

const pct = (x: number | null | undefined) => (x == null ? "–" : `${Math.round(x * 100)} %`);
const num = (x: number | null | undefined) => (x == null ? "–" : Math.round(x).toLocaleString("sv-SE"));

function toBars(area: Share[], ref: Share[]) {
  return area.map((s, i) => ({ label: s.label, a: s.share, b: ref[i]?.share ?? null }));
}

type Ref = { name: string; stats: AreaStats };

function Tile({ label, value, refs }: { label: string; value: string; refs: { name: string; value: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted">{refs.map((r) => `${r.name} ${r.value}`).join(" · ")}</div>
    </div>
  );
}

export function ProfileTiles({ a, refs }: { a: AreaStats; refs: Ref[] }) {
  // Medians only exist for single SCB regions, so the income tile compares means throughout.
  const tiles: { label: string; get: (s: AreaStats) => string }[] = [
    { label: "Invånare", get: (s) => num(s.population) },
    { label: "Medelålder (uppskattad)", get: (s) => `${num(s.averageAge)} år` },
    { label: "Ekonomisk standard, snitt", get: (s) => `${num(s.meanIncome)} tkr` },
    { label: "Eftergymnasial utbildning", get: (s) => pct(s.higherEducationShare) },
    { label: "Förvärvsarbetande 20–64 år", get: (s) => pct(s.employmentRate) },
    { label: "Bor i hyresrätt", get: (s) => pct(s.rentalShare) },
    { label: "Hushåll med barn", get: (s) => pct(s.familiesWithChildrenShare) },
    { label: "Bilar i trafik per 1 000 inv.", get: (s) => num(s.carsPer1000) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <Tile key={t.label} label={t.label} value={t.get(a)} refs={refs.map((r) => ({ name: r.name, value: t.get(r.stats) }))} />
      ))}
    </div>
  );
}

export function ProfileCharts({ a, nameA, reference }: { a: AreaStats; nameA: string; reference: Ref }) {
  const k = reference.stats;
  const quartiles = ["Lägsta fjärdedelen", "Näst lägsta", "Näst högsta", "Högsta fjärdedelen"].map((label, i) => ({
    label,
    a: a.incomeQuartiles[i],
    b: k.incomeQuartiles[i],
  }));
  const bars = { nameA, nameB: reference.name, percent: true, decimals: 1 };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Ålder" subtitle="Andel av invånarna per åldersgrupp." source="SCB, TAB6574">
        <ComparisonBars data={toBars(a.ageBands, k.ageBands)} {...bars} />
      </Card>
      <div className="flex flex-col gap-6">
        <Card title="Hushåll" subtitle="Andel av hushållen per hushållstyp." source="SCB, TAB6568">
          <ComparisonBars data={toBars(a.householdTypes, k.householdTypes)} {...bars} />
        </Card>
        <Card
          title="Inkomst"
          subtitle="Andel invånare i varje fjärdedel av rikets ekonomiska standard (disponibel inkomst per person, justerad för hushållets storlek)."
          source="SCB, TAB6684"
        >
          <ComparisonBars data={quartiles} {...bars} />
        </Card>
      </div>
      <Card title="Boende – upplåtelseform" subtitle="Andel invånare per upplåtelseform." source="SCB, TAB6253">
        <ComparisonBars data={toBars(a.tenure, k.tenure)} {...bars} />
      </Card>
      <Card title="Boende – hustyp" subtitle="Andel invånare per hustyp." source="SCB, TAB6065">
        <ComparisonBars data={toBars(a.houseTypes, k.houseTypes)} {...bars} />
      </Card>
      <Card title="Utbildning" subtitle="Högsta utbildningsnivå, 25–65 år." source="SCB, TAB6534">
        <ComparisonBars data={toBars(a.education, k.education)} {...bars} />
      </Card>
      <Card title="Bebyggelsens ålder" subtitle="Andel bostäder efter byggår." source="SCB, TAB6540">
        <ComparisonBars data={toBars(a.buildingAge, k.buildingAge)} {...bars} />
      </Card>
    </div>
  );
}

export function Summary({ lines, source }: { lines: string[]; source: string }) {
  return (
    <Card title="Sammanfattning" source={source}>
      <div className="flex flex-col gap-2 text-[15px] leading-relaxed">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </Card>
  );
}
