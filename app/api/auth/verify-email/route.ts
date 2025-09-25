import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { CODES } from "../_codes";
import { setVerified, getUserByEmail, publicUser } from "../_users";
import { createSession, withSessionCookie } from "../_session";

function ok(data: any, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}
function bad(message = "Bad Request", init = 400) {
  return NextResponse.json({ success: false, message }, { status: init });
}

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return bad("Некорректный email");
    }
    if (!/^\d{6}$/.test(code ?? "")) {
      return bad("Код должен состоять из 6 цифр");
    }

    // Normalize email to match the storage key
    const normalizedEmail = email.trim().toLowerCase();

    if (process.env.NODE_ENV !== "production") {
      console.log("[VERIFY] store size:", CODES.size);
      console.log("[VERIFY] store keys:", Array.from(CODES.keys()));
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[VERIFY] attempt", { email, normalizedEmail, code });
    }

    // Нововведение: если пользователь уже подтверждён — сразу создаём сессию
    const existingUser = getUserByEmail(normalizedEmail);
    if (existingUser?.verified) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[VERIFY] user already verified, skipping code check");
      }
      const { cookie } = createSession(existingUser.id);
      const res = NextResponse.json({ success: true, user: publicUser(existingUser) });
      res.cookies.set('vfy', '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      return withSessionCookie(res, cookie);
    }

    const record = CODES.get(normalizedEmail);
    if (!record) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[VERIFY] no record for email");
      }
      return bad("Код не найден или истёк");
    }

    record.attempts = (record.attempts ?? 0) + 1;
    if (record.attempts > 5) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[VERIFY] too many attempts", { attempts: record.attempts });
      }
      CODES.delete(normalizedEmail);
      return bad("Слишком много попыток. Запросите новый код", 429);
    }

    if (Date.now() > record.expires) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[VERIFY] code expired", { now: Date.now(), expires: record.expires });
      }
      CODES.delete(normalizedEmail);
      return bad("Срок действия кода истёк");
    }

    if (record.code !== code) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[VERIFY] code mismatch");
      }
      CODES.set(normalizedEmail, record);
      return bad("Неверный код");
    }

    CODES.delete(normalizedEmail);

    // Mark user as verified and create a secure HttpOnly session
    const user = setVerified(normalizedEmail, true) || getUserByEmail(normalizedEmail);
    if (!user) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[VERIFY] user not found after code success", { normalizedEmail });
      }
      return bad("Пользователь не найден", 404);
    }

    const { cookie } = createSession(user.id);
    const res = NextResponse.json({ success: true, user: publicUser(user) });
    res.cookies.set('vfy', '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return withSessionCookie(res, cookie);
  } catch (e) {
    console.error("[VERIFY] exception", e);
    return bad("Ошибка проверки. Попробуйте позже.", 500);
  }
}