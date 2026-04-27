import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, consentData, consentMail, source } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }
    if (!consentData || !consentMail) {
      return NextResponse.json({ error: "Требуется согласие" }, { status: 400 });
    }

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { consentData, consentMail, source: source ?? null },
      create: { email, consentData, consentMail, source: source ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[newsletter]", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
