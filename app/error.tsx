"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Shown when a page cannot load its core data, e.g. when SCB or its map service is down. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Sidan kunde inte laddas just nu</h1>
      <p className="text-ink-2">
        En av datakällorna, oftast SCB:s statistik- eller kartjänst, svarar inte. Försök igen om en stund.
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-lg bg-accent px-4 py-2 font-medium text-white">
          Försök igen
        </button>
        <Link href="/" className="rounded-lg border border-line px-4 py-2 hover:border-accent">
          Till startsidan
        </Link>
      </div>
    </div>
  );
}
