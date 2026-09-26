import { NextResponse } from "next/server";
import { verifyPhoneCode } from "@/lib/phone-verify";
import { enforceSameOrigin } from "@/lib/security";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const csrf = enforceSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit(`phone-verify:${ip}`, 15, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, message: "Слишком много попыток. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => null);
  const res = await verifyPhoneCode(body?.phone ?? "", body?.code ?? "");

  if (res.ok) return NextResponse.json({ success: true });

  const message =
    res.reason === "expired"
      ? "Срок действия кода истёк. Запросите новый."
      : res.reason === "too_many"
      ? "Слишком много неверных попыток. Запросите новый код."
      : res.reason === "not_found"
      ? "Код не запрашивался для этого номера."
      : "Неверный код.";

  return NextResponse.json({ success: false, message }, { status: 400 });
}
