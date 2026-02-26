import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { success: false, message: "Invalid coordinates" },
      { status: 400 }
    );
  }

  const key =
    process.env.MAPTILER_KEY ||
    process.env.NEXT_PUBLIC_MAPTILER_KEY ||
    process.env.NEXT_PUBLIC_MAPTILER_TOKEN ||
    "";

  try {
    let picked = "";
    if (key) {
      const resp = await fetch(
        `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${key}`,
        { headers: { "User-Agent": "StageStore/1.0" } }
      );
      const data = await resp.json().catch(() => null);
      picked = data?.features?.[0]?.place_name || "";
    } else {
      // Fallback to Nominatim (may be rate-limited)
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { "User-Agent": "StageStore/1.0 (contact: info@stagestore.ru)" } }
      );
      const data = await resp.json().catch(() => null);
      picked = data?.display_name || "";
    }

    return NextResponse.json({
      success: true,
      address: picked,
    });
  } catch (e) {
    console.error("[geo.reverse] error", e);
    return NextResponse.json(
      { success: false, message: "Reverse geocoding failed" },
      { status: 502 }
    );
  }
}
