import { NextResponse } from "next/server";
import { getUserByEmail, verifyPassword, publicUser } from "../_users";
import { createSession, SESSION_COOKIE, withSessionCookie } from "../_session";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: "Email и пароль обязательны" },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = getUserByEmail(normalizedEmail);

  if (!user) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[LOGIN]", normalizedEmail, "User not found");
    }
    return NextResponse.json(
      { success: false, error: "Неверный email или пароль" },
      { status: 400 }
    );
  }

  const isPasswordValid = verifyPassword(user, String(password));
  if (!isPasswordValid) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[LOGIN]", normalizedEmail, "Invalid password");
    }
    return NextResponse.json(
      { success: false, error: "Неверный email или пароль" },
      { status: 400 }
    );
  }

  if (user.verified !== true) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[LOGIN]", normalizedEmail, "Email not verified");
    }
    return NextResponse.json(
      { success: false, error: "Подтвердите email перед входом" },
      { status: 403 }
    );
  }

  // Создаём сессию и ставим HttpOnly cookie
  const { cookie } = createSession(user.id);
  const res = NextResponse.json({
    success: true,
    user: publicUser(user), // безопасный профиль без паролей
  });
  return withSessionCookie(res, cookie);
}