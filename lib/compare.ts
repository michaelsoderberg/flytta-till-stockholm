export type Verdict = "better" | "worse" | "similar" | "neutral";

/** Compares a value with a reference; within ±3 % counts as similar. */
export function verdict(value: number, reference: number | null, higherIsBetter: boolean | null): Verdict {
  if (reference == null || higherIsBetter == null || reference === 0) return "neutral";
  const rel = (value - reference) / Math.abs(reference);
  if (Math.abs(rel) < 0.03) return "similar";
  return rel > 0 === higherIsBetter ? "better" : "worse";
}

export function relativeDiff(value: number, reference: number | null) {
  if (reference == null || reference === 0) return null;
  return (value - reference) / Math.abs(reference);
}
