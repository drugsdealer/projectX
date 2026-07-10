import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { getUserIdFromRequest } from "@/lib/session";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { verifyResetCode } from "@/lib/password-reset";

export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;
    const jsonBlocked = requireJsonRequest(req);
    if (jsonBlocked) return jsonBlocked;

    const ip = getClientIp(req);
    const rl = await rateLimit(`password-reset-validate:${ip}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много попыток. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, message: "Код должен состоять из 6 цифр." }, { status: 400 });
    }

    const check = await verifyResetCode(userId, code);
    if (!check.ok) {
      return NextResponse.json({ success: false, message: check.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[password-reset/validate] error");
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
