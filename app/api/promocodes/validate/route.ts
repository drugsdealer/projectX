import { NextRequest, NextResponse } from "next/server";
import { validatePromo } from "@/lib/promos";
import { getUserIdFromRequest } from "@/lib/session";
import { blockIfCsrf } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const csrf = blockIfCsrf(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit(`promo-validate:${ip}`, 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body?.code || "");
  const subtotal = Number(body?.subtotal || 0);
  const userId = await getUserIdFromRequest();

  const result = await validatePromo({ code, subtotal, userId: userId ?? undefined });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
