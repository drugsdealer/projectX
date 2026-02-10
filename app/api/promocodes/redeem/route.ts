import { NextRequest, NextResponse } from "next/server";
import { redeemPromoForOrder, validatePromo } from "@/lib/promos";
import { getUserIdFromRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawCode = (body?.code ?? "").toString().trim();
  const orderIdRaw = body?.orderId ?? null;
  if (!rawCode) {
    return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400 });
  }
  const code = rawCode.toUpperCase();
  const orderId = Number(orderIdRaw);

  const userId = await getUserIdFromRequest();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return NextResponse.json({ ok: false, error: "order_required" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, status: true },
  });
  if (!order || String(order.status) !== "SUCCEEDED") {
    return NextResponse.json({ ok: false, error: "order_not_paid" }, { status: 400 });
  }

  // Проверяем, существует ли промокод и активен ли он
  const validation = await validatePromo({ code, userId });
  if (!validation.ok) {
    if (validation.notFound) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    if (validation.expired) {
      return NextResponse.json({ ok: false, reason: "expired" }, { status: 400 });
    }
    return NextResponse.json(validation, { status: 400 });
  }
  if (validation.alreadyUsed) {
    return NextResponse.json({ ok: false, reason: "already_used" }, { status: 400 });
  }

  try {
    await redeemPromoForOrder({ code, userId, orderId });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // If userId doesn't exist in the DB we can hit a FK error (P2003)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        {
          ok: false,
          error: 'unknown_user',
          message: 'Пользователь не найден. Войдите в аккаунт и попробуйте снова.',
        },
        { status: 401 }
      );
    }

    // Fallback: explicit server error
    return NextResponse.json(
      { ok: false, error: 'server_error', details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
