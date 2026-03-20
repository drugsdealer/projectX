// app/api/yookassa/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { enforceSameOrigin } from "@/lib/security";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // CSRF
  const csrf = enforceSameOrigin(req);
  if (csrf) return csrf;

  // Rate limit: 5 платежей в минуту на IP
  const ip = getClientIp(req);
  const rl = await rateLimit(`yookassa:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много запросов" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // Авторизация
  const userId = await getUserIdFromRequest();
  if (!userId) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  // Парсим тело
  let orderId: number;
  try {
    const body = await req.json();
    orderId = Number(body.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Некорректный orderId" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  // Достаём заказ из БД — сумму берём ТОЛЬКО оттуда
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, totalAmount: true, status: true, token: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  // Проверка владельца
  if (order.userId !== userId) {
    return NextResponse.json({ error: "Нет доступа к заказу" }, { status: 403 });
  }

  // Проверка статуса (не оплачиваем повторно)
  if (order.status === "PAID" || order.status === "COMPLETED") {
    return NextResponse.json({ error: "Заказ уже оплачен" }, { status: 400 });
  }

  const amount = Number(order.totalAmount || 0);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Некорректная сумма заказа" }, { status: 400 });
  }

  // Credentials из переменных окружения
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const apiKey = process.env.YOOKASSA_API_KEY;
  if (!shopId || !apiKey) {
    console.error("[yookassa] YOOKASSA_SHOP_ID or YOOKASSA_API_KEY not configured");
    return NextResponse.json({ error: "Платёжная система не настроена" }, { status: 500 });
  }

  const returnUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/payment/result?orderId=${order.id}`
    : `https://${req.headers.get("host") || "localhost"}/payment/result?orderId=${order.id}`;

  try {
    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": `order-${order.id}-${Date.now()}`,
        Authorization: "Basic " + Buffer.from(`${shopId}:${apiKey}`).toString("base64"),
      },
      body: JSON.stringify({
        amount: {
          value: amount.toFixed(2),
          currency: "RUB",
        },
        confirmation: {
          type: "redirect",
          return_url: returnUrl,
        },
        capture: true,
        description: `Заказ #${order.id}`,
        metadata: { orderId: order.id },
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.confirmation?.confirmation_url) {
      console.error("[yookassa] API error, status:", response.status);
      return NextResponse.json({ error: "Ошибка при создании оплаты" }, { status: 502 });
    }

    return NextResponse.json({
      confirmation_url: data.confirmation.confirmation_url,
      paymentId: data.id,
    });
  } catch (e) {
    console.error("[yookassa] network error");
    return NextResponse.json({ error: "Ошибка соединения с платёжной системой" }, { status: 502 });
  }
}
