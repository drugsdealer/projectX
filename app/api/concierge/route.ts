// app/api/concierge/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  sendConciergeRequestToTelegram,
  type ConciergeAttachment,
} from "@/lib/telegram";
import { blockIfCsrf } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const csrf = blockIfCsrf(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit(`concierge:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = await req.json();

    const {
      name,
      contact,
      category,
      size,
      notes,
      source,
      attachments,
    } = body as {
      name?: string;
      contact?: string;
      category?: string;
      size?: string;
      notes?: string;
      source?: string;
      attachments?: ConciergeAttachment[];
    };

    const lines: string[] = [];
    lines.push("🧷 Новая заявка в консьерж-сервис");
    lines.push("");
    lines.push("💎 Новый запрос в консьерж");
    if (source) lines.push(`Источник: ${source}`);
    if (name) lines.push(`Имя: ${name}`);
    if (contact) lines.push(`Контакт: ${contact}`);
    if (category) lines.push(`Категория: ${category}`);
    if (size) lines.push(`Размер: ${size}`);

    if (notes) {
      lines.push("");
      lines.push("Комментарий:");
      lines.push(notes);
    }

    if (attachments?.length) {
      lines.push("");
      lines.push(`Вложения: ${attachments.length} файл(ов)`);
      attachments.forEach((f, idx) => {
        lines.push(
          `${idx + 1}. ${f.name || "file"} (${f.type || "unknown"})`
        );
      });
    }

    const text = lines.join("\n");

    await sendConciergeRequestToTelegram({
      text,
      attachments,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/concierge] error", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}