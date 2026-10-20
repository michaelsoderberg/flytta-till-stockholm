"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { GeocodeResult } from "@/lib/geocode";

export type Place = { label: string; sub: string; href: string };

function matchPlaces(places: Place[], query: string) {
  const q = query.trim().toLocaleLowerCase("sv-SE");
  if (q.length < 2) return [];
  const starts = places.filter((p) => p.label.toLocaleLowerCase("sv-SE").startsWith(q));
  const contains = places.filter((p) => !starts.includes(p) && p.label.toLocaleLowerCase("sv-SE").includes(q));
  return [...starts, ...contains].slice(0, 6);
}

export default function SearchBox({ places }: { places: Place[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [addresses, setAddresses] = useState<GeocodeResult[] | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "locating">("idle");
  const [error, setError] = useState<string | null>(null);
  const matches = useMemo(() => matchPlaces(places, query), [places, query]);

  async function searchAddress(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setStatus("searching");
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAddresses(json.results);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Sökningen misslyckades.");
    } finally {
      setStatus("idle");
    }
  }

  async function openAddress(r: GeocodeResult) {
    setStatus("locating");
    setError(null);
    try {
      const res = await fetch(`/api/deso?lat=${r.lat}&lon=${r.lon}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.push(`/omrade/${json.deso}?adress=${encodeURIComponent(r.label.split(",").slice(0, 2).join(","))}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Kunde inte hitta området.");
      setStatus("idle");
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={searchAddress} className="flex gap-2" role="search">
        <label htmlFor="search" className="sr-only">Adress, stadsdel eller grannskap</label>
        <input
          id="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAddresses(null);
          }}
          placeholder="Adress eller område, t.ex. Götgatan 10 eller Hammarbyhöjden"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          autoComplete="off"
        />
        <button type="submit" disabled={status !== "idle"} className="rounded-lg bg-accent px-5 py-3 font-medium text-white disabled:opacity-60">
          {status === "searching" ? "Söker…" : "Sök"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      {status === "locating" && <p className="mt-3 text-sm text-ink-2">Hämtar området…</p>}

      {(matches.length > 0 || addresses) && (
        <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface text-left">
          {matches.length > 0 && (
            <ul>
              <li className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted">Områden</li>
              {matches.map((p) => (
                <li key={p.href}>
                  <button onClick={() => router.push(p.href)} className="flex w-full justify-between gap-4 px-4 py-2 text-left hover:bg-page">
                    <span>{p.label}</span>
                    <span className="text-sm text-muted">{p.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {addresses && (
            <ul className={matches.length ? "border-t border-line" : ""}>
              <li className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted">Adresser i Stockholm</li>
              {addresses.length === 0 && <li className="px-4 py-2 text-sm text-ink-2">Inga adresser hittades.</li>}
              {addresses.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button onClick={() => openAddress(r)} className="w-full px-4 py-2 text-left hover:bg-page">
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!addresses && matches.length > 0 && (
            <p className="border-t border-line px-4 py-2 text-xs text-muted">Tryck Sök för att leta efter en adress.</p>
          )}
        </div>
      )}
    </div>
  );
}
