const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? "Kommunkollen/0.1 (open data demo)";

export type GeocodeResult = { label: string; lat: number; lon: number };

const cache = new Map<string, GeocodeResult[]>();
let lastRequest = 0;

/** Nominatim's usage policy allows at most one request per second. */
async function throttle() {
  const wait = lastRequest + 1100 - Date.now();
  lastRequest = Math.max(Date.now(), lastRequest + 1100);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const key = query.trim().toLocaleLowerCase("sv-SE");
  if (!key) return [];
  const cached = cache.get(key);
  if (cached) return cached;
  await throttle();
  // Limited to Stockholm municipality's bounding box.
  const q = /stockholm/i.test(query) ? query : `${query}, Stockholm`;
  const params = new URLSearchParams({
    q,
    addressdetails: "1",
    format: "jsonv2",
    countrycodes: "se",
    limit: "6",
    "accept-language": "sv",
    viewbox: "17.75,59.44,18.20,59.22",
    bounded: "1",
  });
  const res = await fetch(`${NOMINATIM}?${params}`, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = (await res.json()) as {
    display_name: string;
    lat: string;
    lon: string;
    address?: { municipality?: string };
  }[];
  // The bounding box also covers neighbouring municipalities such as Solna and Sundbyberg.
  const results = json
    .filter((r) => !r.address?.municipality || r.address.municipality === "Stockholms kommun")
    .map((r) => ({
    label: r.display_name
      .replace(/, Sverige$/, "")
      .replace(/, \d{3} \d{2}$/, "")
      .replace(/, Stockholms (kommun|län)/g, "")
      .replace(/, [^,]+ stadsdelsområde/, "")
      .replace(/, Stockholm$/, ""),
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
  cache.set(key, results);
  return results;
}
