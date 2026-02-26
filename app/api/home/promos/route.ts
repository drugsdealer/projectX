import { NextResponse } from "next/server";

import { readHomeCmsPromos } from "@/lib/home-promos-cms";

export const runtime = "nodejs";

export async function GET() {
  try {
    const promos = await readHomeCmsPromos();
    const active = promos.filter((promo) => promo.enabled);
    return NextResponse.json({ success: true, promos: active });
  } catch (err) {
    console.error("[home.promos.GET]", err);
    return NextResponse.json({ success: true, promos: [] });
  }
}
