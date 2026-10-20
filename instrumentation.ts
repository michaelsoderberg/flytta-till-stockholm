/** Polls the Polisen API in the background while the Node server runs, so event history accumulates. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_POLISEN_POLLING) return;
  const { collectIfStale } = await import("@/lib/polisen");
  void collectIfStale();
  setInterval(() => void collectIfStale(), 10 * 60 * 1000).unref();
}
