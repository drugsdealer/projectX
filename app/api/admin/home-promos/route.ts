import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin";
import { readHomeCmsPromos, writeHomeCmsPromos } from "@/lib/home-promos-cms";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  try {
    const promos = await readHomeCmsPromos();
    return NextResponse.json({ success: true, promos });
  } catch (err) {
    console.error("[admin.home-promos.GET]", err);
    return NextResponse.json({ success: false, message: "Не удалось загрузить CMS-промо" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));

  try {
    const promos = await writeHomeCmsPromos(body?.promos);
    return NextResponse.json({ success: true, promos });
  } catch (err: any) {
    console.error("[admin.home-promos.PUT]", err);
    const message = typeof err?.message === "string" ? err.message : "Не удалось сохранить CMS-промо";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
