"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

export default function AreaMap({ geometry }: { geometry: GeoJSON.Geometry }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const layer = L.geoJSON(geometry, {
      style: { color: "#2a78d6", weight: 2, fillColor: "#2a78d6", fillOpacity: 0.15 },
    }).addTo(map);
    map.fitBounds(layer.getBounds(), { padding: [16, 16] });
    return () => {
      map.remove();
    };
  }, [geometry]);

  return <div ref={ref} className="h-72 w-full overflow-hidden rounded-xl border border-line" aria-label="Karta över området" />;
}
