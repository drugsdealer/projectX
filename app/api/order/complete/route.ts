import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getUserIdFromRequest } from "@/lib/session";
import { cookies } from "next/headers";


// Универсально получаем enum значения из разных версий Prisma Client
const PENDING_ENUM: any = (Prisma as any)?.OrderStatus?.PENDING
  ?? (Prisma as any)?.$Enums?.OrderStatus?.PENDING
  ?? "PENDING";
const SUCCEEDED_ENUM: any = (Prisma as any)?.OrderStatus?.SUCCEEDED
  ?? (Prisma as any)?.$Enums?.OrderStatus?.SUCCEEDED
  ?? "SUCCEEDED";

export async function POST(req: Request) {
  try {
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
    const token = typeof tokenRaw === "string" && tokenRaw.trim() !== "" ? tokenRaw.trim() : null;

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
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    // Дополнительная защита: если заказ привязан к другому пользователю — запрещаем завершение
    if (order.userId && userId && order.userId !== userId) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 },
      );
    }

    // Если заказ уже оплачен — считаем ок и возвращаем id
    if (String(order.status) === String(SUCCEEDED_ENUM)) {
      return NextResponse.json({ success: true, orderId: order.id });
    }

    // Человеко-читаемый номер заказа, детерминированный по id (исключает гонки и пересечения)
    const publicNumber = `STG-${String(order.id).padStart(6, "0")}`;

    // 4) Готовим данные для обновления
    const updateBase: Prisma.OrderUpdateInput = {
      status: { set: SUCCEEDED_ENUM } as any,
      publicNumber: { set: publicNumber } as any,
      ...(userId ? { User: { connect: { id: userId } } } : {}),
    };

    // 5) Пытаемся обновить с paidAt, если колонки нет — дублируем попытку без paidAt
    let updated: { id: number; token: string | null; publicNumber: string | null } | null = null;
    try {
      updated = await prisma.order.update({
        where: { id: order.id },
        data: { ...(updateBase as any), paidAt: new Date() },
        select: { id: true, token: true, publicNumber: true },
      });
    } catch (err) {
      // Колонка paidAt может отсутствовать — повторяем без неё
      updated = await prisma.order.update({
        where: { id: order.id },
        data: updateBase,
        select: { id: true, token: true, publicNumber: true },
      });
    }

    // 6) Выставляем гостевой токен, чтобы история заказов отображалась
    const res = NextResponse.json({
      success: true,
      orderId: updated.id,
      publicNumber: updated.publicNumber,
    });
    if (updated.token) {
      res.cookies.set("orderToken", updated.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 60, // 60 дней
      });
    }

    return res;
  } catch (e) {
    console.error("[order.complete] fail:", e);
    return NextResponse.json({ success: false, message: "Confirm failed" }, { status: 400 });
  }
}