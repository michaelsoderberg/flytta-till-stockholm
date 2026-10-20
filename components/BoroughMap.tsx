"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import { colorFor } from "@/lib/ramp";

export default function BoroughMap({
  geojson,
  values,
  labels,
  highlight,
}: {
  geojson: FeatureCollection;
  values: Record<string, number | null>;
  labels: Record<string, string>;
  highlight?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false, zoomSnap: 0.25 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nums = Object.values(values).filter((v): v is number => v != null);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    layerRef.current?.remove();
    const layer = L.geoJSON(geojson, {
      style: (f) => {
        const id = f?.properties?.id as string;
        return {
          color: id === highlight ? "#0b0b0b" : "#fcfcfb",
          weight: id === highlight ? 3 : 1.5,
          fillColor: colorFor(values[id] ?? null, min, max),
          fillOpacity: 0.8,
        };
      },
      onEachFeature: (f, l) => {
        const id = f.properties?.id as string;
        l.bindTooltip(`<strong>${f.properties?.name}</strong><br>${labels[id] ?? ""}`, { sticky: true });
        l.on("click", () => router.push(`/stadsdel/${id}`));
        l.on("mouseover", () => (l as L.Path).setStyle({ weight: 3, color: "#0b0b0b" }));
        l.on("mouseout", () => layer.resetStyle(l as L.Path));
      },
    }).addTo(map);
    layerRef.current = layer;
    if (!map.getZoom()) map.fitBounds(layer.getBounds(), { padding: [8, 8] });
  }, [geojson, values, labels, highlight, router]);

  return <div ref={ref} className="h-[440px] w-full overflow-hidden rounded-xl border border-line" aria-label="Karta över Stockholms stadsdelsområden" />;
}
