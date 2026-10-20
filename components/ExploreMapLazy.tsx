"use client";

import dynamic from "next/dynamic";

const ExploreMap = dynamic(() => import("./ExploreMap"), {
  ssr: false,
  loading: () => <div className="h-[460px] w-full animate-pulse rounded-xl border border-line bg-surface" />,
});

export default ExploreMap;
