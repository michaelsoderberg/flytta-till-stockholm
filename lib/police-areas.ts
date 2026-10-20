import { BOROUGHS, NEIGHBOURHOODS, STOCKHOLM_KOD, titleCase } from "@/lib/stockholm";
import type { PoliceEvent } from "@/lib/polisen";

/** Common place names in police texts that are not stadsdel or RegSO names. */
const ALIASES: Record<string, string> = {
  Vasastan: "norra-innerstaden",
  Vasastaden: "norra-innerstaden",
  Gärdet: "norra-innerstaden",
  Odenplan: "norra-innerstaden",
  Stureplan: "norra-innerstaden",
  "Sergels torg": "norra-innerstaden",
  Centralstationen: "norra-innerstaden",
  "T-Centralen": "norra-innerstaden",
  "Stockholm city": "norra-innerstaden",
  Karlaplan: "norra-innerstaden",
  "Hammarby sjöstad": "sodermalm",
  Slussen: "sodermalm",
  Medborgarplatsen: "sodermalm",
  Hornstull: "sodermalm",
  Skanstull: "sodermalm",
  Mariatorget: "sodermalm",
  Fridhemsplan: "kungsholmen",
  "S:t Eriksplan": "kungsholmen",
  Spånga: "jarva",
  Hjulsta: "jarva",
  Frescati: "norra-innerstaden",
  Humlegården: "norra-innerstaden",
  Kungsträdgården: "norra-innerstaden",
  Vasaparken: "norra-innerstaden",
  Drakenbergsparken: "sodermalm",
  Drakenbergparken: "sodermalm",
  Tantolunden: "sodermalm",
  Rålambshovsparken: "kungsholmen",
  "Bromma flygplats": "bromma",
  "Kungliga slottet": "sodermalm",
  Högalidsparken: "sodermalm",
  Blekholmsterassen: "norra-innerstaden",
  Kungstensgatan: "norra-innerstaden",
  Gottsunda: "",
};

type Matcher = { name: string; borough: string; re: RegExp };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildMatchers(): Matcher[] {
  const names = new Map<string, string>();
  for (const b of BOROUGHS) {
    names.set(b.name, b.id);
    for (const s of b.stadsdelar) names.set(titleCase(s), b.id);
  }
  for (const n of NEIGHBOURHOODS) names.set(n.name, n.borough);
  for (const [alias, borough] of Object.entries(ALIASES)) {
    if (borough) names.set(alias, borough);
    else names.delete(alias);
  }
  // Longer names first, so "Hässelby strand" wins over "Hässelby".
  return [...names.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([name, borough]) => ({
      name,
      borough,
      // Whole words only, allowing a genitive s ("Södermalms tunnelbana").
      re: new RegExp(`(?<![\\p{L}\\d])${escape(name)}s?(?![\\p{L}\\d])`, "iu"),
    }));
}

let matchers: Matcher[] | undefined;

export type PlacedEvent = PoliceEvent & { borough: string | null; place: string | null };

/** Places a Stockholm police event in a borough when its text mentions a known place. */
export function placeEvent(event: PoliceEvent): PlacedEvent {
  matchers ??= buildMatchers();
  const text = event.summary;
  let best: { index: number; text: string; m: Matcher } | null = null;
  for (const m of matchers) {
    const hit = m.re.exec(text);
    if (hit && (!best || hit.index < best.index)) best = { index: hit.index, text: hit[0], m };
  }
  if (!best) return { ...event, borough: null, place: null };
  // Show the place as written in the text, without a genitive s.
  const place = best.text.length > best.m.name.length ? best.text.slice(0, best.m.name.length) : best.text;
  return { ...event, borough: best.m.borough, place };
}

export function isStockholmEvent(event: PoliceEvent) {
  return event.kommunkod === STOCKHOLM_KOD;
}
