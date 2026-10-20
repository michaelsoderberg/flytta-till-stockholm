import { NextRequest, NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 200) ?? "";
  if (q.trim().length < 3) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await geocode(q) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Adress-sökningen är inte tillgänglig just nu." }, { status: 502 });
  }
}
