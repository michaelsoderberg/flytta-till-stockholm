/** Sequential blue ramp, light to dark (validated reference palette steps 150–650). */
export const RAMP = ["#b7d3f6", "#6da7ec", "#2a78d6", "#1c5cab", "#104281"];

export function colorFor(value: number | null, min: number, max: number) {
  if (value == null) return "#c3c2b7";
  const t = max === min ? 0.5 : (value - min) / (max - min);
  return RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
}
