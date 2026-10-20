const BASE = "https://api.scb.se/OV0104/v2beta/api/v2";
const DAY = 60 * 60 * 24;

export type JsonStat2 = {
  id: string[];
  size: number[];
  value: (number | null)[];
  updated?: string;
  dimension: Record<string, { category: { index: Record<string, number>; label: Record<string, string> } }>;
};

export class StatTable {
  constructor(readonly data: JsonStat2) {}

  /** Value for one code per dimension. Dimensions with a single category may be omitted. */
  get(codes: Record<string, string>): number | null {
    let offset = 0;
    let stride = 1;
    for (let i = this.data.id.length - 1; i >= 0; i--) {
      const dim = this.data.id[i];
      const index = this.data.dimension[dim].category.index;
      let pos: number | undefined;
      if (dim in codes) pos = index[codes[dim]];
      else if (this.data.size[i] === 1) pos = 0;
      if (pos === undefined) return null;
      offset += pos * stride;
      stride *= this.data.size[i];
    }
    return this.data.value[offset] ?? null;
  }

  codes(dim: string): string[] {
    const index = this.data.dimension[dim].category.index;
    return Object.keys(index).sort((a, b) => index[a] - index[b]);
  }

  label(dim: string, code: string): string {
    return this.data.dimension[dim].category.label[code] ?? code;
  }

  /** The year (Tid) in the response, when a single year was requested. */
  get year(): string | null {
    return this.data.dimension.Tid ? this.codes("Tid")[0] : null;
  }
}

const cache = new Map<string, { at: number; table: Promise<StatTable> }>();

/**
 * Fetches a table with the given selections; Tid defaults to the latest year. Uses POST because
 * region lists for a whole city are too long for a URL, and caches results in memory for a day.
 */
export function queryTable(table: string, selection: Record<string, string[]>): Promise<StatTable> {
  const sel = { Tid: ["top(1)"], ...selection };
  const key = `${table}:${JSON.stringify(sel)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY * 1000) return hit.table;
  const body = JSON.stringify({
    selection: Object.entries(sel).map(([variableCode, valueCodes]) => ({ variableCode, valueCodes })),
  });
  const promise = (async () => {
    // SCB allows 30 requests per 10 seconds and occasionally drops connections; retry with backoff.
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`${BASE}/tables/${table}/data?lang=sv&outputFormat=json-stat2`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          cache: "no-store",
        });
        if (res.status === 429 || res.status >= 500) throw new Error(`SCB ${table} ${res.status}`);
        if (!res.ok) throw new Error(`SCB ${table} ${res.status}: ${await res.text()}`, { cause: "client" });
        return new StatTable((await res.json()) as JsonStat2);
      } catch (err) {
        if (attempt >= 2 || (err instanceof Error && err.cause === "client")) throw err;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  })();
  cache.set(key, { at: Date.now(), table: promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

export const desoRegionCode = (deso: string) => `${deso}_DeSO2025`;
export const regsoRegionCode = (regso: string) => `${regso}_RegSO2025`;
