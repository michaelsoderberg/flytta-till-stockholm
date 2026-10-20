import { NextRequest, NextResponse } from "next/server";
import { collectEvents } from "@/lib/polisen";

export const dynamic = "force-dynamic";

/** Called by a scheduler (e.g. Vercel Cron) every 10 minutes. Set CRON_SECRET to protect it. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await collectEvents());
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
