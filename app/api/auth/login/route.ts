export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { setSessionOnResponse } from "../../_utils/session";
import { cookies as nextCookies } from "next/headers";
import { handleApiError } from "@/lib/errors";
import { logAction } from "@/lib/logAction";

// Логин по email+password. Ставит httpOnly куку `session_user_id`,
// которую читает твой getSessionUserId() / getUserIdFromRequest().
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    // Пробуем вытащить гостевой токен заказа из кук (если пользователь оформлял без авторизации)
    const cookieStore = await nextCookies();
    // NB: In Next 15 cookies()/headers() are async; we already awaited it above.
    // Read potential guest order token created during checkout-as-guest.
    const guestToken =
      cookieStore.get("orderToken")?.value ??
      cookieStore.get("order_token")?.value ??
      null;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Введите email и пароль" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true, role: true, password: true, deletedAt: true },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, message: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    if (user.deletedAt) {
      return NextResponse.json(
        { success: false, message: "Профиль деактивирован" },
        { status: 403 }
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { success: false, message: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    const res = NextResponse.json(
      { success: true, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } },
      { status: 200 }
    );

    const isProd = process.env.NODE_ENV === "production";
    // Ставит основную httpOnly куку сессии (session_user_id)
    setSessionOnResponse(res, user.id);

    // Доп. не-httpOnly кука для клиентского UI (по желанию)
    res.cookies.set("stage_session", JSON.stringify({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    }), {
      httpOnly: false,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    // Совместимость: часть кода читает `uid`. Дублируем id в эту куку.
    res.cookies.set("uid", String(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    // Если есть гостевой токен заказа — привяжем все такие заказы к пользователю и очистим токен
    if (guestToken) {
      try {
        await prisma.order.updateMany({
          where: { token: guestToken, userId: null },
          data: { userId: user.id },
        });
        // Чистим гостевой токен, чтобы не мешал истории
        res.cookies.set("orderToken", "", { path: "/", maxAge: 0 });
        res.cookies.set("order_token", "", { path: "/", maxAge: 0 });
      } catch (e) {
        console.warn("[LOGIN] failed to bind guest orders:", e);
      }
    }

    try {
      await logAction(user.id, "User", "LOGIN", {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      });
    } catch (e) {
      console.error("[LOGIN] failed to write audit log:", e);
    }

    return res;
  } catch (error) {
    console.error("[LOGIN] error:", error);
    return handleApiError(error);
}
}