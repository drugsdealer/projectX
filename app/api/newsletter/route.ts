import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanSource(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 80);
}

export async function POST(req: NextRequest) {
  const csrf = blockIfCsrf(req);
  if (csrf) return csrf;
  const json = requireJsonRequest(req);
  if (json) return json;

  const ip = getClientIp(req);
  const ipLimit = await rateLimit(`newsletter:ip:${ip}`, 8, 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { email, consentData, consentMail, source } = body;
    const normalizedEmail = String(email ?? "").trim().toLowerCase();

    if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }
    if (!consentData || !consentMail) {
      return NextResponse.json({ error: "Требуется согласие" }, { status: 400 });
    }

    const emailLimit = await rateLimit(`newsletter:email:${normalizedEmail}`, 3, 10 * 60_000);
    if (!emailLimit.ok) {
      return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    }

    const safeSource = cleanSource(source) || null;
    await prisma.newsletterSubscriber.upsert({
      where: { email: normalizedEmail },
      update: { consentData: true, consentMail: true, source: safeSource },
      create: { email: normalizedEmail, consentData: true, consentMail: true, source: safeSource },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[newsletter] failed");
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
