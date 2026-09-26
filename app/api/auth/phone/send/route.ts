import { NextResponse } from "next/server";
import { sendPhoneCode, normalizePhone } from "@/lib/phone-verify";
import { enforceSameOrigin } from "@/lib/security";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const csrf = enforceSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit(`phone-send:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, message: "Слишком много запросов. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.phone ?? "");
  if (!phone) {
    return NextResponse.json({ success: false, message: "Некорректный номер телефона" }, { status: 400 });
  }

  const res = await sendPhoneCode(phone);
  if (!res.ok) {
    const message =
      res.reason === "rate_limited"
        ? "Код запрашивали слишком часто. Подождите немного."
        : "Не удалось отправить код. Попробуйте позже.";
    return NextResponse.json({ success: false, message }, { status: res.reason === "rate_limited" ? 429 : 502 });
  }

  // Канал сообщаем, чтобы подписать поле ввода: «код в Telegram» или «код в СМС».
  return NextResponse.json({ success: true, channel: res.channel });
}
