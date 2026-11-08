/**
 * Polls the Polisen API in the background while the Node server runs, so event history accumulates.
 * Skipped on Vercel: serverless functions don't stay alive, so a GitHub Actions schedule calls
 * /api/cron/polisen instead (.github/workflows/polisen-cron.yml).
 */
export async function register() {
  // The import must sit inside this check, so the Edge build can drop the database client.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.DISABLE_POLISEN_POLLING || process.env.VERCEL) return;
    const { collectIfStale } = await import("@/lib/polisen");
    void collectIfStale();
    setInterval(() => void collectIfStale(), 10 * 60 * 1000).unref();
  }
}
