import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";

export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;
    const jsonBlocked = requireJsonRequest(req);
    if (jsonBlocked) return jsonBlocked;

    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, message: "Код должен состоять из 6 цифр." }, { status: 400 });
    }

    const record = await prisma.passwordResetCode.findUnique({
      where: { userId },
    });
    if (!record || record.code !== code) {
      return NextResponse.json({ success: false, message: "Неверный код." }, { status: 400 });
    }

    const isExpired = record.createdAt.getTime() < Date.now() - 10 * 60 * 1000;
    if (isExpired) {
      return NextResponse.json({ success: false, message: "Срок кода истёк." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[password-reset/validate] error", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
