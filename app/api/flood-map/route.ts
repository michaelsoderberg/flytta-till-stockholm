import { NextRequest, NextResponse } from "next/server";
import { TIMEOUT_MS } from "@/lib/http";

/**
 * Proxy for MCF's (formerly MSB) flood map images, so the browser never calls MCF directly and each tile
 * is fetched from MCF at most once per cache period. Leaflet's WMS layer sends standard WMS GetMap
 * parameters; only what the app needs is accepted and forwarded.
 */
const MCF_WMS = "https://gis-tjanster.mcf.se/arcgis/services/Oversvamningskarteringar/hotkartor_2026/MapServer/WMSServer";
const DAY = 60 * 60 * 24;

/** 57: cloudburst (skyfall) Stockholm, 100-year rain. 78: Mälaren, 100-year flow. */
const LAYERS = new Set(["57", "78"]);
const MAX_SIZE_PX = 512;
/** Stockholm municipality in Web Mercator (EPSG:3857), with a margin. */
const AREA = { minX: 1_900_000, minY: 8_150_000, maxX: 2_110_000, maxY: 8_350_000 };
/** Largest tile extent accepted (metres), roughly zoom level 8. */
const MAX_EXTENT_M = 160_000;

function parseBbox(value: string | null) {
  const parts = (value ?? "").split(",").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const [minX, minY, maxX, maxY] = parts;
  if (minX >= maxX || minY >= maxY) return null;
  if (maxX - minX > MAX_EXTENT_M || maxY - minY > MAX_EXTENT_M) return null;
  const overlapsStockholm = maxX > AREA.minX && minX < AREA.maxX && maxY > AREA.minY && minY < AREA.maxY;
  return overlapsStockholm ? parts : null;
}

function parseSize(value: string | null) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= MAX_SIZE_PX ? n : null;
}

export async function GET(req: NextRequest) {
  // Leaflet sends lower-case parameter names; accept either case.
  const q = new Map([...req.nextUrl.searchParams].map(([k, v]) => [k.toLowerCase(), v]));
  const layer = q.get("layers") ?? "";
  const bbox = parseBbox(q.get("bbox") ?? null);
  const width = parseSize(q.get("width") ?? null);
  const height = parseSize(q.get("height") ?? null);
  const crs = q.get("srs") ?? q.get("crs");
  if (!LAYERS.has(layer) || !bbox || !width || !height || crs !== "EPSG:3857") {
    return NextResponse.json({ error: "Ogiltig kartförfrågan" }, { status: 400 });
  }

  // Parameters are rebuilt from validated values; nothing from the request is passed on as-is.
  const params = new URLSearchParams({
    service: "WMS",
    request: "GetMap",
    version: "1.1.1",
    layers: layer,
    styles: "",
    format: "image/png",
    transparent: "true",
    srs: "EPSG:3857",
    bbox: bbox.join(","),
    width: String(width),
    height: String(height),
  });

  try {
    const res = await fetch(`${MCF_WMS}?${params}`, {
      next: { revalidate: DAY * 30 },
      signal: AbortSignal.timeout(TIMEOUT_MS.wms),
    });
    // ArcGIS reports some errors as XML with status 200, so check that an image came back.
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
      throw new Error(`MCF WMS ${res.status} ${res.headers.get("content-type")}`);
    }
    return new NextResponse(await res.arrayBuffer(), {
      headers: {
        "Content-Type": res.headers.get("content-type")!,
        "Cache-Control": `public, max-age=${DAY}, s-maxage=${DAY * 30}`,
      },
    });
  } catch (err) {
    console.error("Flood map tile failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Översvämningskartan är inte tillgänglig just nu" }, { status: 502 });
  }
}
