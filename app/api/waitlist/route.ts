import { NextRequest, NextResponse } from "next/server";

import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { sendConciergeRequestToTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const csrf = blockIfCsrf(req);
  if (csrf) return csrf;
  const json = requireJsonRequest(req);
  if (json) return json;

  const ip = getClientIp(req);
  const rl = await rateLimit(`waitlist:${ip}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = await req.json();
    const productId = Number(body?.productId);
    const productName = cleanText(body?.productName, 180);
    const brand = cleanText(body?.brand, 120);
    const size = cleanText(body?.size, 80);
    const contact = cleanText(body?.contact, 160);
    const pageUrl = cleanText(body?.pageUrl, 300);

    if (!Number.isFinite(productId) || productId <= 0 || !productName || !size || contact.length < 5) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const lines: string[] = [];
    lines.push("📌 <b>Лист ожидания размера</b>");
    lines.push("");
    lines.push(`<b>Товар:</b> ${escapeTelegramHtml(productName)}`);
    lines.push(`<b>ID:</b> ${escapeTelegramHtml(String(productId))}`);
    if (brand) lines.push(`<b>Бренд:</b> ${escapeTelegramHtml(brand)}`);
    lines.push(`<b>Размер:</b> ${escapeTelegramHtml(size)}`);
    lines.push(`<b>Контакт:</b> ${escapeTelegramHtml(contact)}`);
    if (pageUrl) lines.push(`<b>Страница:</b> ${escapeTelegramHtml(pageUrl)}`);

    await sendConciergeRequestToTelegram({ text: lines.join("\n") });

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
