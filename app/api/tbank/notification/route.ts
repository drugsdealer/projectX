import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { verifyTBankNotification } from "@/lib/tbank";
import { sendOrderNotificationToTelegram } from "@/lib/telegram";
import { sendOrderReceipt } from "@/lib/receipt-email";
import { redeemPromoForOrder } from "@/lib/promos";

/**
 * Нотификация от T-Bank о смене статуса платежа.
 *
 * Запрос приходит с серверов банка — сессии и CSRF-токена здесь нет,
 * поэтому единственная защита — проверка подписи (Token). Без неё кто угодно
 * мог бы отправить «оплачено» и получить товар бесплатно.
 *
 * Банк ждёт в ответ строку "OK", иначе будет повторять отправку.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new NextResponse("ERROR", { status: 400 });
  }

  if (!verifyTBankNotification(body as Record<string, unknown>)) {
    console.warn("[tbank.notification] invalid signature — rejected");
    return new NextResponse("ERROR", { status: 403 });
  }

  const status = String((body as any).Status || "");
  const orderId = Number((body as any).OrderId);
  const paymentId = String((body as any).PaymentId ?? "");

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return new NextResponse("OK");
  }

  // Успешной считаем только CONFIRMED (одностадийная оплата — списание прошло).
  if (status !== "CONFIRMED") {
    console.log(`[tbank.notification] order ${orderId} status=${status} — оплата не завершена`);
    return new NextResponse("OK");
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, userId: true, publicNumber: true, totalAmount: true },
    });
    if (!order) return new NextResponse("OK");

    // Идемпотентность: банк может прислать нотификацию повторно.
    if (order.status === "SUCCEEDED") return new NextResponse("OK");

    const publicNumber = order.publicNumber || `STG-${String(order.id).padStart(6, "0")}`;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "SUCCEEDED",
        paidAt: new Date(),
        publicNumber,
        ...(paymentId ? { paymentId } : {}),
      },
    });

    // Побочные эффекты не должны ломать ответ банку — каждый в своём try.
    const full = await prisma.order
      .findUnique({
        where: { id: order.id },
        select: {
          id: true, token: true, totalAmount: true, fullName: true, phone: true,
          email: true, address: true, publicNumber: true, paidAt: true, promoCode: true,
          userId: true,
          OrderItem: {
            select: { quantity: true, price: true, size: true, Product: { select: { name: true } } },
          },
        },
      })
      .catch(() => null);

    if (full) {
      try {
        await sendOrderNotificationToTelegram({
          orderId: full.publicNumber || full.id,
          token: full.token,
          amount: Number(full.totalAmount || 0),
          fullName: full.fullName || undefined,
          phone: full.phone || undefined,
          email: full.email || undefined,
        });
      } catch {
        console.error("[tbank.notification] telegram notify failed");
      }

      if (full.email) {
        try {
          await sendOrderReceipt({
            to: full.email,
            orderNumber: full.publicNumber || publicNumber,
            fullName: full.fullName || "Покупатель",
            address: full.address || "",
            phone: full.phone || null,
            totalAmount: Number(full.totalAmount || 0),
            paidAt: full.paidAt || new Date(),
            items: (full.OrderItem || []).map((it: any) => ({
              name: it.Product?.name || "Товар",
              quantity: it.quantity ?? 1,
              price: Number(it.price ?? 0),
              size: it.size || null,
            })),
          });
        } catch {
          console.error("[tbank.notification] receipt email failed");
        }
      }

      if (full.promoCode && full.userId) {
        try {
          await redeemPromoForOrder({
            code: full.promoCode,
            userId: full.userId,
            orderId: full.id,
          });
        } catch {
          console.error("[tbank.notification] promo redeem failed");
        }
      }
    }

    return new NextResponse("OK");
  } catch (e) {
    console.error("[tbank.notification] processing error");
    // Отвечаем ошибкой, чтобы банк повторил попытку позже.
    return new NextResponse("ERROR", { status: 500 });
  }
}
