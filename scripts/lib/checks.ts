// Sanity checks for build scripts. A source that answers 200 but has changed format, or sends only part of
// its data, would otherwise produce a valid-looking but empty or zeroed JSON file that silently replaces good
// data. Every script runs these checks before writing, and throws instead of writing when they fail.
import { existsSync, readFileSync } from "node:fs";

/** Reads the previously built file, or null if there is none yet (first build). */
export function previousBuild<T = unknown>(file: string): T | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null;
}

/** Throws unless `actual` is at least `min`. */
export function assertAtLeast(what: string, actual: number, min: number) {
  if (!(actual >= min)) {
    throw new Error(`${what}: got ${actual}, expected at least ${min}. The existing file was not overwritten.`);
  }
}

/**
 * Throws if `actual` dropped below `minRatio` of the previous build's value, which usually means a partial
 * download or a changed source format rather than a real change. Skipped on the first build.
 */
export function assertComparable(what: string, actual: number, previous: number | null | undefined, minRatio = 0.9) {
  if (previous == null || previous === 0) return;
  if (!(actual >= previous * minRatio)) {
    throw new Error(
      `${what}: got ${actual}, the previous build had ${previous} (minimum ${Math.round(minRatio * 100)} %). ` +
        `This usually means a partial download or a changed source format. The existing file was not overwritten.`,
    );
  }
}

/** Throws if a fetch response is not OK, naming the URL and including the start of the body. */
export async function assertOk(res: Response, what: string) {
  if (res.ok) return;
  const body = (await res.text().catch(() => "")).slice(0, 200);
  throw new Error(`${what}: HTTP ${res.status} from ${res.url}${body ? ` – ${body}` : ""}`);
}
