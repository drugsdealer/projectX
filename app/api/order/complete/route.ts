import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getUserIdFromRequest } from "@/lib/session";
import { cookies } from "next/headers";
import { sendOrderNotificationToTelegram } from "@/lib/telegram";
import { redeemPromoForOrder } from "@/lib/promos";
import { emitServerEvents, type ServerTrackEventPayload } from "@/lib/events-server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  blockIfCsrf,
  buildPrivateHeaders,
  privateJson,
  requireJsonRequest,
  tooManyRequests,
} from "@/lib/api-hardening";

// Универсально получаем enum значения из разных версий Prisma Client
const PENDING_ENUM: any = (Prisma as any)?.OrderStatus?.PENDING
  ?? (Prisma as any)?.$Enums?.OrderStatus?.PENDING
  ?? "PENDING";
const SUCCEEDED_ENUM: any = (Prisma as any)?.OrderStatus?.SUCCEEDED
  ?? (Prisma as any)?.$Enums?.OrderStatus?.SUCCEEDED
  ?? "SUCCEEDED";

export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;

    const ip = getClientIp(req);
    const ipLimit = await rateLimit(`order:complete:ip:${ip}`, 30, 60_000);
    if (!ipLimit.ok) {
      return tooManyRequests(ipLimit.retryAfter);
    }

    const contentType = req.headers.get("content-type") || "";
    if (contentType) {
      const jsonBlocked = requireJsonRequest(req);
      if (jsonBlocked) return jsonBlocked;
    }

    // 1) Собираем источники orderId / token
    let body: any = {};
    try { body = await req.json(); } catch {}

    const url = new URL(req.url);
    const orderIdRaw = body.orderId ?? url.searchParams.get("orderId");
    const jar = await cookies();
    const tokenRaw = body.token ?? url.searchParams.get("token") ?? jar.get("orderToken")?.value ?? null;

    const userId = await getUserIdFromRequest();

    // 2) Нормализуем orderId
    const parsedId = orderIdRaw !== undefined && orderIdRaw !== null ? Number(orderIdRaw) : NaN;
    const hasId = Number.isFinite(parsedId) && parsedId > 0;
    const tokenCandidate = typeof tokenRaw === "string" && tokenRaw.trim() !== "" ? tokenRaw.trim() : null;
    const token =
      tokenCandidate && tokenCandidate.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(tokenCandidate)
        ? tokenCandidate
        : null;

    // 3) Находим целевой заказ: по id, по токену, либо последнюю PENDING запись пользователя
    const selectBase = { id: true, token: true, status: true, userId: true } as const;
    let order = null as null | { id: number; token: string | null; status: any; userId: number | null };

    if (hasId) {
      order = await prisma.order.findUnique({ where: { id: parsedId }, select: selectBase });
    }
    if (!order && token) {
      order = await prisma.order.findFirst({ where: { token }, orderBy: { createdAt: "desc" }, select: selectBase });
    }
    if (!order && userId) {
      order = await prisma.order.findFirst({ where: { userId, status: PENDING_ENUM }, orderBy: { createdAt: "desc" }, select: selectBase });
    }

    if (!order) {
      return privateJson({ success: false, message: "Order not found" }, { status: 404 });
    }

    // Дополнительная защита: если заказ привязан к другому пользователю — запрещаем завершение
    if (order.userId && userId && order.userId !== userId) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403, headers: buildPrivateHeaders() },
      );
    }

    const alreadySucceeded = String(order.status) === String(SUCCEEDED_ENUM);
    // Если заказ уже оплачен — считаем ок и возвращаем id
    if (alreadySucceeded) {
      return privateJson({ success: true, orderId: order.id });
    }

    // Человеко-читаемый номер заказа, детерминированный по id (исключает гонки и пересечения)
    const publicNumber = `STG-${String(order.id).padStart(6, "0")}`;

    // 4) Готовим данные для обновления
    const updateBase: Prisma.OrderUpdateInput = {
      status: { set: SUCCEEDED_ENUM } as any,
      publicNumber: { set: publicNumber } as any,
      ...(userId && !order.userId ? { User: { connect: { id: userId } } } : {}),
    };

    // 5) Пытаемся обновить с paidAt, если колонки нет — дублируем попытку без paidAt
    let updated: {
      id: number;
      token: string | null;
      publicNumber: string | null;
      totalAmount: number | null;
      fullName: string | null;
      phone: string | null;
      email: string | null;
    } | null = null;
    try {
      updated = await prisma.order.update({
        where: { id: order.id },
        data: { ...(updateBase as any), paidAt: new Date() },
        select: {
          id: true,
          token: true,
          publicNumber: true,
          totalAmount: true,
          fullName: true,
          phone: true,
          email: true,
        },
      });
    } catch (err) {
      // Колонка paidAt может отсутствовать — повторяем без неё
      updated = await prisma.order.update({
        where: { id: order.id },
        data: updateBase,
        select: {
          id: true,
          token: true,
          publicNumber: true,
          totalAmount: true,
          fullName: true,
          phone: true,
          email: true,
        },
      });
    }

    // 6) Выставляем гостевой токен, чтобы история заказов отображалась
    const res = privateJson(
      {
        success: true,
        orderId: updated.id,
        publicNumber: updated.publicNumber,
      },
    );
    if (updated.token) {
      res.cookies.set("orderToken", updated.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 60, // 60 дней
      });
    }

    try {
      await sendOrderNotificationToTelegram({
        orderId: updated.publicNumber || updated.id,
        token: updated.token ?? null,
        amount: Number(updated.totalAmount || 0),
        fullName: updated.fullName || undefined,
        phone: updated.phone || undefined,
        email: updated.email || undefined,
      });
    } catch (err) {
      console.error("[order.complete] telegram notify failed:", err);
    }

    // Промокод списываем только после успешной оплаты
    try {
      const promoOrder = await prisma.order.findUnique({
        where: { id: updated.id },
        select: { promoCode: true, userId: true, status: true },
      });
      if (
        promoOrder?.promoCode &&
        promoOrder.userId &&
        String(promoOrder.status) === String(SUCCEEDED_ENUM)
      ) {
        await redeemPromoForOrder({
          code: promoOrder.promoCode,
          userId: promoOrder.userId,
          orderId: updated.id,
        });
      }
    } catch (err) {
      console.error("[order.complete] promo redeem failed:", err);
    }

    void (async () => {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: updated.id },
        select: {
          productId: true,
          quantity: true,
          price: true,
          Product: {
            select: {
              brandId: true,
              categoryId: true,
            },
          },
        },
      });

      const purchaseEvents: ServerTrackEventPayload[] = orderItems.length
        ? orderItems.map((item) => ({
            eventType: "PURCHASE",
            userId: userId ?? undefined,
            sessionId: updated.token ?? `order-${updated.id}`,
            productId: item.productId ?? undefined,
            orderId: updated.id,
            pageUrl: "/checkout/success",
            source: "next-api",
            deviceType: "server",
            occurredAt: new Date().toISOString(),
            metadata: {
              quantity: item.quantity,
              price: item.price,
              publicNumber: updated.publicNumber,
              brandId: item.Product?.brandId ?? null,
              categoryId: item.Product?.categoryId ?? null,
            },
          }))
        : [
            {
              eventType: "PURCHASE",
              userId: userId ?? undefined,
              sessionId: updated.token ?? `order-${updated.id}`,
              orderId: updated.id,
              pageUrl: "/checkout/success",
              source: "next-api",
              deviceType: "server",
              occurredAt: new Date().toISOString(),
              metadata: {
                publicNumber: updated.publicNumber,
              },
            },
          ];

      await emitServerEvents(purchaseEvents);
    })().catch((err) => {
      console.error("[order.complete] analytics emit failed:", err);
    });

    return res;
  } catch (e) {
    console.error("[order.complete] fail:", e);
    return privateJson({ success: false, message: "Confirm failed" }, { status: 400 });
  }
}
