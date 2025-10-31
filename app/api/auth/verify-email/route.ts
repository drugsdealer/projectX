import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { setSessionOnResponse } from "../../_utils/session";

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

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!existingUser) {
      return bad("Пользователь не найден", 404);
    }

    // уже подтвержден — сразу создаём сессию
    if (existingUser.verified && existingUser.verified.getTime() > 0) {
      const res = NextResponse.json({
        success: true,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          verified: existingUser.verified,
          fullName: existingUser.fullName ?? "",
          role: existingUser.role,
        },
      });
      setSessionOnResponse(res, existingUser.id);
      res.cookies.set("vfy", "", {
        path: "/",
        expires: new Date(0),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      // UI/helper cookies (non-httpOnly) for client hydration
      res.cookies.set("stage_session", JSON.stringify({
        id: existingUser.id,
        email: existingUser.email,
        fullName: existingUser.fullName ?? "",
        role: existingUser.role,
      }), {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      res.cookies.set("uid", String(existingUser.id), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    const verification = await prisma.verificationCode.findUnique({
      where: { userId: existingUser.id },
    });
    if (!verification || verification.code !== code) {
      return bad("Код не найден или неверен");
    }

    // Срок действия 10 минут
    const isExpired =
      verification.createdAt.getTime() < Date.now() - 10 * 60 * 1000;
    if (isExpired) {
      await prisma.verificationCode.delete({ where: { userId: existingUser.id } }).catch(() => {});
      return bad("Срок действия кода истёк");
    }

    // Отметить пользователя как подтверждённого и создать сессию
    const updatedUser = await prisma.user.update({
      where: { email: normalizedEmail },
      data: { verified: new Date(), updatedAt: new Date() },
    }).catch(() => null);

    await prisma.verificationCode.delete({ where: { userId: existingUser.id } }).catch(() => {});

    if (!updatedUser) {
      return bad("Пользователь не найден", 404);
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        verified: updatedUser.verified,
        fullName: updatedUser.fullName ?? "",
        role: updatedUser.role,
      },
    });

    setSessionOnResponse(res, updatedUser.id);
    res.cookies.set("vfy", "", { path: "/", expires: new Date(0), httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.cookies.set("stage_session", JSON.stringify({
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName ?? "",
      role: updatedUser.role,
    }), {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.set("uid", String(updatedUser.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (e) {
    console.error("[VERIFY] exception", e);
    return bad("Ошибка проверки. Попробуйте позже.", 500);
  }
}
