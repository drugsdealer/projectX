// app/api/concierge/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  sendConciergeRequestToTelegram,
  type ConciergeAttachment,
} from "@/lib/telegram";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

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

function safeAttachment(input: unknown): ConciergeAttachment | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const type = cleanText(item.type, 80).toLowerCase();
  const data = typeof item.data === "string" ? item.data.trim() : "";
  if (!ALLOWED_ATTACHMENT_TYPES.has(type)) return null;
  if (!/^[a-z0-9+/]+={0,2}$/i.test(data)) return null;
  if (Math.floor((data.length * 3) / 4) > MAX_ATTACHMENT_BYTES) return null;

  return {
    name: cleanText(item.name, 120).replace(/[\\/]/g, "_") || "attachment",
    type,
    data,
  };
}

export async function POST(req: NextRequest) {
  const csrf = blockIfCsrf(req);
  if (csrf) return csrf;
  const json = requireJsonRequest(req);
  if (json) return json;

  const ip = getClientIp(req);
  const rl = await rateLimit(`concierge:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = await req.json();

    const raw = body as {
      name?: string;
      contact?: string;
      category?: string;
      size?: string;
      notes?: string;
      source?: string;
      attachments?: ConciergeAttachment[];
    };
    const name = cleanText(raw.name, 120);
    const contact = cleanText(raw.contact, 160);
    const category = cleanText(raw.category, 120);
    const size = cleanText(raw.size, 80);
    const notes = cleanText(raw.notes, 1200);
    const source = cleanText(raw.source, 80);
    const attachments = Array.isArray(raw.attachments)
      ? raw.attachments.slice(0, MAX_ATTACHMENTS).map(safeAttachment).filter(Boolean) as ConciergeAttachment[]
      : undefined;

    if (!name && !contact && !notes) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const lines: string[] = [];
    lines.push("🧷 Новая заявка в консьерж-сервис");
    lines.push("");
    lines.push("💎 Новый запрос в консьерж");
    if (source) lines.push(`Источник: ${escapeTelegramHtml(source)}`);
    if (name) lines.push(`Имя: ${escapeTelegramHtml(name)}`);
    if (contact) lines.push(`Контакт: ${escapeTelegramHtml(contact)}`);
    if (category) lines.push(`Категория: ${escapeTelegramHtml(category)}`);
    if (size) lines.push(`Размер: ${escapeTelegramHtml(size)}`);

    if (notes) {
      lines.push("");
      lines.push("Комментарий:");
      lines.push(escapeTelegramHtml(notes));
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
    console.error("[api/concierge] error");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
