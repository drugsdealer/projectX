import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isPhoneVerified, normalizePhone } from "@/lib/phone-verify";
import { enforceSameOrigin } from "@/lib/security";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  setSessionOnResponse,
  setSessionTokenOnResponse,
  setSessionClaimOnResponse,
} from "../../../_utils/session";

export const runtime = "nodejs";

/**
 * Завершение входа/регистрации по телефону.
 *
 * Раньше страница подтверждения просто помечала пользователя вошедшим в браузере,
 * а на сервере учётной записи не появлялось: после перезагрузки вход исчезал.
 * Теперь аккаунт создаётся по-настоящему, и сессия выдаётся сервером.
 */
export async function POST(req: Request) {
  const csrf = enforceSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit(`phone-complete:${ip}`, 10, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, message: "Слишком много запросов. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.phone ?? "");
  if (!phone) {
    return NextResponse.json({ success: false, message: "Некорректный номер" }, { status: 400 });
  }

  // Сессию выдаём только если номер действительно подтверждён кодом,
  // и подтверждение свежее. Иначе достаточно было бы знать чужой номер.
  if (!(await isPhoneVerified(phone))) {
    return NextResponse.json(
      { success: false, message: "Номер не подтверждён. Запросите код заново." },
      { status: 403 }
    );
  }

  let user = await prisma.user.findFirst({
    where: { phone, deletedAt: null },
    select: { id: true, fullName: true, email: true, phone: true },
  });

  if (!user) {
    // Пароля у такой учётки нет: вход только по коду из сообщения.
    user = await prisma.user.create({
      data: {
        fullName: "Не указано",
        email: `${phone.replace("+", "")}@phone.stagestore.app`,
        password: randomBytes(32).toString("hex"),
        phone,
        verified: new Date(),
      },
      select: { id: true, fullName: true, email: true, phone: true },
    });
  }

  const token = randomBytes(32).toString("hex");
  const hasAny = await prisma.userSession.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  await prisma.userSession.create({
    data: {
      userId: user.id,
      token,
      isPrimary: !hasAny,
      ip,
      userAgent: (req.headers.get("user-agent") || "").slice(0, 500),
    },
  });

  const res = NextResponse.json({
    success: true,
    user: { id: user.id, name: user.fullName, phone: user.phone },
  });
  setSessionOnResponse(res, user.id);
  setSessionTokenOnResponse(res, token);
  setSessionClaimOnResponse(res, user.id);
  return res;
}
