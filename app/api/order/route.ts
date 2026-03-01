import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getUserIdFromRequest } from "@/lib/session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { privateJson, tooManyRequests } from "@/lib/api-hardening";

/**
 * Возвращает историю заказов:
 * - для авторизованного пользователя по userId
 * - либо для гостя по guest token (order_token | checkout_token | cart_token | guest_token)
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipLimit = await rateLimit(`order:history:ip:${ip}`, 120, 60_000);
    if (!ipLimit.ok) {
      return tooManyRequests(ipLimit.retryAfter);
    }

    // Достаём cookies один раз (в App Router cookies() нужно вызывать как async)
    const jar = await cookies();

    // 1) userId из нашей сессии/next-auth-обёртки
    const rawSessId = await getUserIdFromRequest();
    let effectiveUserId: number | null = null;

    if (rawSessId != null) {
      const n =
        typeof rawSessId === "string"
          ? parseInt(rawSessId, 10)
          : Number(rawSessId);
      if (Number.isFinite(n) && n > 0) {
        effectiveUserId = n;
      }
    }

    // 1.1) fallback: из cookie session_user_id (если есть)
    if (!effectiveUserId) {
      const cookieUser = jar.get("session_user_id")?.value || null;
      const n2 = cookieUser ? parseInt(cookieUser, 10) : NaN;
      if (Number.isFinite(n2) && n2 > 0) {
        effectiveUserId = n2;
      }
    }

    // 2) guest token из cookie / query / header
    const cookieToken =
      jar.get("order_token")?.value ||
      jar.get("checkout_token")?.value ||
      jar.get("cart_token")?.value ||
      jar.get("guest_token")?.value ||
      null;

    const qs = req.nextUrl.searchParams;
    const qsToken = qs.get("token");
    const hdrToken = req.headers.get("x-guest-token");

    const tokenRaw = (qsToken || hdrToken || cookieToken) ?? null;
    const token =
      typeof tokenRaw === "string" &&
      tokenRaw.length <= 128 &&
      /^[a-zA-Z0-9._:-]+$/.test(tokenRaw)
        ? tokenRaw
        : null;

    // 3) DEV-перекрытие userId (?userId=...) — только в non-production окружениях
    if (!effectiveUserId && process.env.NODE_ENV !== "production") {
      const qsUserId = qs.get("userId");
      if (qsUserId) {
        const n = Number(qsUserId);
        if (Number.isFinite(n) && n > 0) {
          effectiveUserId = n;
        }
      }
    }

    // 4) Если нет ни userId, ни токена — 401
    if (!effectiveUserId && !token) {
      console.log("[api.order] Unauthorized: no userId and no token");
      return privateJson({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // 5) where-условие (по userId и/или токену)
    const baseWhere: Prisma.OrderWhereInput =
      effectiveUserId && token
        ? { OR: [{ userId: effectiveUserId }, { token }] }
        : effectiveUserId
        ? { userId: effectiveUserId }
        : { token };

    // Дополнительная защита: не показываем мягко удалённые заказы
    const whereSafe: Prisma.OrderWhereInput = {
      AND: [baseWhere, { deletedAt: null }],
    };

    console.log("[api.order] filters", {
      userId: effectiveUserId ?? null,
      hasToken: Boolean(token),
    });

    // 6) Заказы с позициями и продуктами (ограничиваем поля через select)
    const orders = await prisma.order.findMany({
      where: whereSafe,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        token: true,
        totalAmount: true,
        status: true,
        paymentId: true,
        fullName: true,
        email: true,
        phone: true,
        address: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        paidAt: true,
        publicNumber: true,
        OrderItem: {
          select: {
            id: true,
            productId: true,
            name: true,
            price: true,
            size: true,
            quantity: true,
            image: true,
            Product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                price: true,
              },
            },
          },
        },
      },
    });

    // Совместимость: добавляем alias items
    const normalized = (orders as any[]).map((o) => ({
      ...o,
      items: o.OrderItem ?? [],
      // paidAt для старых заказов: если есть успешный статус, но нет paidAt — fallback на updatedAt
      paidAt:
        o.paidAt ??
        ((o.status === "SUCCEEDED" || o.status === "PAID") ? o.updatedAt : null),
      publicNumber: o.publicNumber ?? null,
    }));

    return privateJson({ success: true, orders: normalized }, { status: 200 });
  } catch (err) {
    console.error("[api.order] failed:", err);
    return privateJson({ success: false, message: "Server error" }, { status: 500 });
  }
}
