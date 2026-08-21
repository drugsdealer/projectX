import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { enforceSameOrigin } from "@/lib/security";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { requireJsonRequest } from "@/lib/api-hardening";
import { tbankInit, getTBankConfig } from "@/lib/tbank";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export async function POST(req: Request) {
  const csrf = enforceSameOrigin(req);
  if (csrf) return csrf;
  const jsonBlocked = requireJsonRequest(req);
  if (jsonBlocked) return jsonBlocked;

  const ip = getClientIp(req);
  const rl = await rateLimit(`tbank-init:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, message: "Слишком много запросов" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  if (!getTBankConfig()) {
    return NextResponse.json(
      { success: false, message: "Оплата временно недоступна" },
      { status: 503 }
    );
  }

  const userId = await getUserIdFromRequest();
  if (!userId) {
    return NextResponse.json({ success: false, message: "Требуется авторизация" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const orderId = Number(body?.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return NextResponse.json({ success: false, message: "Некорректный orderId" }, { status: 400 });
  }

  // Заказ и сумму берём ТОЛЬКО из БД — клиентским значениям не доверяем.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, totalAmount: true, status: true, publicNumber: true },
  });

  if (!order) {
    return NextResponse.json({ success: false, message: "Заказ не найден" }, { status: 404 });
  }
  if (order.userId !== userId) {
    return NextResponse.json({ success: false, message: "Нет доступа к заказу" }, { status: 403 });
  }
  if (order.status === "SUCCEEDED") {
    return NextResponse.json({ success: false, message: "Заказ уже оплачен" }, { status: 400 });
  }

  const rubles = Number(order.totalAmount || 0);
  if (!rubles || rubles <= 0) {
    return NextResponse.json({ success: false, message: "Некорректная сумма заказа" }, { status: 400 });
  }

  const result = await tbankInit({
    // T-Bank принимает сумму в копейках
    amountKopecks: Math.round(rubles * 100),
    orderId: String(order.id),
    description: `Заказ ${order.publicNumber || `#${order.id}`} — Stage Store`,
    successUrl: `${SITE_URL}/payment/result?orderId=${order.id}`,
    failUrl: `${SITE_URL}/payment/result?orderId=${order.id}&failed=1`,
    notificationUrl: `${SITE_URL}/api/tbank/notification`,
    customerKey: String(userId),
  });

  if (!result.ok) {
    console.error("[tbank.init] failed:", result.errorCode ?? "", result.message);
    return NextResponse.json(
      { success: false, message: "Не удалось создать платёж" },
      { status: 502 }
    );
  }

  // Сохраняем PaymentId — по нему потом сверяем реальный статус у банка.
  await prisma.order
    .update({ where: { id: order.id }, data: { paymentId: result.paymentId } })
    .catch((e) => console.error("[tbank.init] failed to save paymentId", e));

  return NextResponse.json({
    success: true,
    paymentUrl: result.paymentUrl,
    paymentId: result.paymentId,
  });
}
