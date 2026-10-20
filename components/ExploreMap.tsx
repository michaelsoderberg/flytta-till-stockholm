"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

export type MapMarker = { lat: number; lon: number; label: string; sub?: string; href?: string | null };
export type MapGroup = { key: string; label: string; color: string; markers: MapMarker[]; on?: boolean };

/** MCF's flood maps, fetched through our own cached proxy (app/api/flood-map) rather than from MCF directly. */
const FLOOD_WMS = "/api/flood-map";
const OVERLAYS = [
  { key: "skyfall", label: "Översvämning vid skyfall (100-årsregn)", layers: "57" },
  { key: "malaren", label: "Mälaren, 100-årsflöde", layers: "78" },
];

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export default function ExploreMap({ geometry, groups }: { geometry: GeoJSON.Geometry; groups: MapGroup[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef<Record<string, L.Layer>>({});
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([...groups.map((g) => [g.key, !!g.on]), ...OVERLAYS.map((o) => [o.key, false])]),
  );

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false, preferCanvas: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, översvämning: MCF',
    }).addTo(map);
    const outline = L.geoJSON(geometry, { style: { color: "#2a78d6", weight: 2, fillOpacity: 0.04 } }).addTo(map);
    map.fitBounds(outline.getBounds(), { padding: [12, 12] });

    for (const o of OVERLAYS) {
      layers.current[o.key] = L.tileLayer.wms(FLOOD_WMS, { layers: o.layers, format: "image/png", transparent: true, opacity: 0.75 });
    }
    for (const g of groups) {
      const fg = L.featureGroup();
      for (const m of g.markers) {
        const html = `<strong>${escape(m.label)}</strong>${m.sub ? `<br>${escape(m.sub)}` : ""}${
          m.href ? `<br><a href="${escape(m.href)}" target="_blank" rel="noreferrer">Mer information</a>` : ""
        }`;
        L.circleMarker([m.lat, m.lon], { radius: 6, color: "#fcfcfb", weight: 1.5, fillColor: g.color, fillOpacity: 0.95 })
          .bindPopup(html)
          .addTo(fg);
      }
      layers.current[g.key] = fg;
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layers.current = {};
    };
  }, [geometry, groups]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [key, layer] of Object.entries(layers.current)) {
      if (active[key] && !map.hasLayer(layer)) layer.addTo(map);
      if (!active[key] && map.hasLayer(layer)) layer.remove();
    }
  }, [active, groups]);

  const toggle = (key: string) => setActive((a) => ({ ...a, [key]: !a[key] }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lager på kartan">
        {groups.map((g) => (
          <button
            key={g.key}
            onClick={() => toggle(g.key)}
            aria-pressed={active[g.key]}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${active[g.key] ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent"}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} aria-hidden />
            {g.label} <span className="tabular text-xs text-muted">{g.markers.length}</span>
          </button>
        ))}
        {OVERLAYS.map((o) => (
          <button
            key={o.key}
            onClick={() => toggle(o.key)}
            aria-pressed={active[o.key]}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${active[o.key] ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent"}`}
          >
            <span className="h-2.5 w-4 rounded-sm" style={{ background: "linear-gradient(90deg,#bbf6fc,#0c8bfa)" }} aria-hidden />
            {o.label}
          </button>
        ))}
      </div>
      <div ref={ref} className="h-[460px] w-full overflow-hidden rounded-xl border border-line" aria-label="Karta över området" />
    </div>
  );
}
