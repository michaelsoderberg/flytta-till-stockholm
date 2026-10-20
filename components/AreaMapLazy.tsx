"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` on import, so it is only loaded in the browser.
const AreaMap = dynamic(() => import("./AreaMap"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-xl border border-line bg-surface" />,
});

export default AreaMap;
