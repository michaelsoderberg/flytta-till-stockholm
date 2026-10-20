/** Time limits for calls to external services, so a slow source cannot hang a page or a request. */
export const TIMEOUT_MS = {
  /** SCB statistics: large requests covering all of Stockholm. */
  scb: 20_000,
  /** SCB's map service (WFS): single-area lookups. */
  wfs: 10_000,
  polisen: 10_000,
  nominatim: 8_000,
  /** MCF flood map images. */
  wms: 10_000,
} as const;

/**
 * Awaits data that a page can do without: on failure, logs it and returns null, so the page renders
 * the remaining sections instead of failing as a whole.
 */
export async function optional<T>(promise: Promise<T>, label: string): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    console.error(`${label} unavailable:`, err instanceof Error ? err.message : err);
    return null;
  }
}
