import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { cookies } from "next/headers";
import { SESSION_TOKEN_COOKIE } from "../../../_utils/session";

const HOURS_24 = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = Number(body?.id);
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ success: false, message: "Bad session id" }, { status: 400 });
    }

    const jar: any = cookies() as any;
    const cookieJar = typeof jar?.then === "function" ? await jar : jar;
    const token = cookieJar?.get?.(SESSION_TOKEN_COOKIE)?.value || null;
    if (!token) {
      return NextResponse.json({ success: false, message: "Session token missing" }, { status: 401 });
    }

    const current = await prisma.userSession.findUnique({
      where: { token },
      select: { id: true, userId: true, createdAt: true, revokedAt: true },
    });
    if (!current || current.userId !== userId || current.revokedAt) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (Date.now() - current.createdAt.getTime() < HOURS_24) {
      return NextResponse.json(
        { success: false, message: "С этой сессии можно отключать другие устройства только через 24 часа." },
        { status: 403 }
      );
    }

    if (current.id === sessionId) {
      return NextResponse.json({ success: false, message: "Нельзя завершить текущую сессию этим способом." }, { status: 400 });
    }

    const target = await prisma.userSession.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ success: false, message: "Сессия не найдена" }, { status: 404 });
    }

    await prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[sessions/revoke] error", e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
