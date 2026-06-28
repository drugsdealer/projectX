import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;
    const jsonBlocked = requireJsonRequest(req);
    if (jsonBlocked) return jsonBlocked;

    const ip = getClientIp(req);
    const rl = await rateLimit(`forgot-verify:ip:${ip}`, 15, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много попыток. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, message: "Неверный код." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
    if (!user || user.deletedAt) {
      return NextResponse.json({ success: false, message: "Неверный код." }, { status: 400 });
    }

    const record = await prisma.passwordResetCode.findUnique({ where: { userId: user.id } });
    if (!record || !timingSafeEqual(Buffer.from(record.code), Buffer.from(code))) {
      return NextResponse.json({ success: false, message: "Неверный код." }, { status: 400 });
    }

    const isExpired = record.createdAt.getTime() < Date.now() - 10 * 60 * 1000;
    if (isExpired) {
      await prisma.passwordResetCode.delete({ where: { userId: user.id } }).catch(() => {});
      return NextResponse.json({ success: false, message: "Срок кода истёк." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[forgot-password/verify] error");
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
