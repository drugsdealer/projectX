import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../_session";

const sessions = new Map<string, any>();

export function deleteSession(sessionId: string) {
  sessions.delete(sessionId);
}

export async function POST(req: Request) {
  try {
    // Получаем ID сессии из cookie
    const cookieHeader = req.headers.get("cookie") || "";
    const sessionCookie = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`));

    if (process.env.NODE_ENV !== "production") {
      console.log("[LOGOUT] cookie header:", cookieHeader);
      console.log("[LOGOUT] found session cookie:", sessionCookie);
    }

    if (sessionCookie) {
      const sessionId = sessionCookie.split("=")[1];
      deleteSession(sessionId);

      if (process.env.NODE_ENV !== "production") {
        console.log("[LOGOUT] session deleted:", sessionId);
      }
    }

    // Устанавливаем cookie с истекшим сроком для удаления в браузере
    const res = NextResponse.json({
      success: true,
      message: "Вы вышли из системы",
      loggedOut: true, // Флаг для фронтенда, использовать для сброса состояния пользователя
    });
    res.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
      sameSite: "lax",
    });

    return res;
  } catch (error) {
    console.error("[LOGOUT] error:", error);
    return NextResponse.json(
      { success: false, message: "Ошибка при выходе" },
      { status: 500 }
    );
  }
}