import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { upsertUser, getUserByEmail, publicUser } from "../_users";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ success: false, message: "Некорректный email" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ success: false, message: "Пароль слишком короткий" }, { status: 400 });
    }

    const exists = getUserByEmail(email);
    if (process.env.NODE_ENV !== "production" && exists) {
      console.log("[REGISTER]", {
        email,
        name,
        existed: true,
        verified: exists.verified,
        createdAt: new Date().toISOString(),
      });
    }

    const user = upsertUser({ email, password, name });

    if (process.env.NODE_ENV !== "production") {
      console.log("[REGISTER]", {
        email: user.email,
        name: user.name,
        existed: !!exists,
        verified: user.verified,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, user: publicUser(user), existed: !!exists });
  } catch (e) {
    console.error("[REGISTER] exception", e);
    return NextResponse.json({ success: false, message: "Ошибка регистрации" }, { status: 500 });
  }
}