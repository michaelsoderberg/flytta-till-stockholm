import { NextRequest, NextResponse } from "next/server";
import { desoAtPoint } from "@/lib/deso";

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat och lon krävs" }, { status: 400 });
  }
  try {
    const feature = await desoAtPoint(lat, lon);
    if (!feature || feature.kommunkod !== "0180") {
      return NextResponse.json({ error: "Adressen ligger utanför Stockholms stad." }, { status: 404 });
    }
    return NextResponse.json({ deso: feature.deso, kommunkod: feature.kommunkod });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "SCB:s kartjänst svarar inte just nu." }, { status: 502 });
  }
}
