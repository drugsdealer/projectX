import { NextRequest, NextResponse } from "next/server";
import { validatePromo } from "@/lib/promos";
import { getUserIdFromRequest } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = String(body?.code || "");
  const subtotal = Number(body?.subtotal || 0);
  const userId = await getUserIdFromRequest();

  const result = await validatePromo({ code, subtotal, userId: userId ?? undefined });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
