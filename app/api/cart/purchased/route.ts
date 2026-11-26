import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest, getGuestToken } from "@/lib/session";
import { enforceSameOrigin } from "@/lib/security";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { removePurchasedFromCart } from "@/lib/cart-purchased";

export const runtime = "nodejs";

/**
 * Страница «Оплата прошла» вызывает это, чтобы убрать купленное из корзины.
 * Сервер делает то же самое сам при уведомлении банка; здесь — ещё и корзина гостя (по куке).
 */
export async function POST(req: Request) {
  const csrf = enforceSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit(`cart-purchased:${ip}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ success: false }, { status: 429 });

  const body = await req.json().catch(() => null);
  const orderId = Number(body?.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, token: true, status: true },
    });
    if (!order) return NextResponse.json({ success: false }, { status: 404 });

    // Только владелец заказа: вошедший — по сессии, гость — по ключу заказа из куки.
    const userId = await getUserIdFromRequest();
    const guestToken = await getGuestToken();
    const owns =
      (userId != null && order.userId === userId) ||
      (order.userId == null && !!guestToken && order.token === guestToken);
    if (!owns) return NextResponse.json({ success: false }, { status: 403 });
    if (order.status !== "SUCCEEDED") return NextResponse.json({ success: true, removed: 0 });

    const jar = await cookies();
    const cartToken = jar.get("cart_token")?.value;
    const cart = cartToken
      ? await prisma.cart.findFirst({ where: { token: cartToken }, select: { id: true } })
      : null;

    const removed = await removePurchasedFromCart(orderId, { extraCartId: cart?.id ?? null });
    return NextResponse.json({ success: true, removed });
  } catch {
    console.error("[cart.purchased] error");
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
