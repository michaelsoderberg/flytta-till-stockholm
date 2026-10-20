import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { collectEvents } from "@/lib/polisen";

export const dynamic = "force-dynamic";

function authorized(header: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  // Constant-time comparison, so response timing reveals nothing about the secret.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Called by a scheduler (e.g. Vercel Cron) every 10 minutes with `Authorization: Bearer <CRON_SECRET>`.
 * Closed by default: without CRON_SECRET configured, every request is refused.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }
  if (!authorized(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await collectEvents());
  } catch (err) {
    // Details stay in the server log; the caller only learns that collection failed.
    console.error("Polisen collection failed", err);
    return NextResponse.json({ error: "Collection failed" }, { status: 502 });
  }
}
