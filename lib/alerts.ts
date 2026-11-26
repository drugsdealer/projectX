// lib/alerts.ts — сообщения об ошибках сайта в Telegram (только на сервере).
//
// Куда пишем: TELEGRAM_ALERTS_BOT_TOKEN + TELEGRAM_ALERTS_CHAT_ID (отдельный чат «Ошибки сайта»).
// Если они не заданы — тот же бот и чаты, что и для заказов (TELEGRAM_ORDER_*).
//
// Чтобы не засыпать чат: одна и та же ошибка приходит не чаще раза в 30 минут
// (счётчик общий для всех серверов через Upstash), и всего не больше 30 сообщений в час.
// Личные данные покупателей (почта, телефон, адрес) в сообщения не кладём.

import { rateLimit } from "@/lib/rate-limit";
import { IS_STAGING } from "@/lib/staging";

export type AlertArea =
  | "register"
  | "login"
  | "email-code"
  | "phone-code"
  | "password-reset"
  | "checkout"
  | "payment"
  | "payment-notify"
  | "receipt"
  | "server"
  | "page-crash"
  | "browser";

const AREA_LABEL: Record<AlertArea, string> = {
  register: "Регистрация",
  login: "Вход в аккаунт",
  "email-code": "Код на почту",
  "phone-code": "Код по телефону",
  "password-reset": "Восстановление пароля",
  checkout: "Оформление заказа",
  payment: "Оплата",
  "payment-notify": "Ответ банка об оплате",
  receipt: "Письмо-чек",
  server: "Ошибка сервера",
  "page-crash": "Страница «Что-то пошло не так»",
  browser: "Ошибка в браузере покупателя",
};

// Самое важное — красным, остальное — жёлтым.
const CRITICAL: ReadonlySet<AlertArea> = new Set(["payment", "payment-notify", "checkout", "register", "login"]);

const REPEAT_WINDOW_MS = 30 * 60_000;
const HOURLY_CAP = 30;

function parseChatIds(value?: string) {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function escapeHtml(value: unknown, max = 600) {
  return String(value ?? "")
    .slice(0, max)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// На всякий случай вырезаем из текста ошибки почту, телефоны и длинные токены.
function scrub(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[почта]")
    .replace(/\+?\d[\d\s()-]{9,}\d/g, "[номер]")
    .replace(/(postgres(?:ql)?:\/\/)[^\s"']+/gi, "$1[скрыто]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[ключ]");
}

export function errorText(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) {
    const code = (error as any).code ? ` (${(error as any).code})` : "";
    return `${error.name}: ${error.message}${code}`;
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error).slice(0, 500);
  } catch {
    return String(error);
  }
}

// Короткий отпечаток текста (FNV-1a) — работает и в Node, и в edge-среде.
function fingerprint(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + text.length.toString(36);
}

function moscowTime() {
  return new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type ProblemReport = {
  area: AlertArea;
  /** Человеческое описание: «Банк не создал платёж». */
  title: string;
  /** Техническая причина (исключение или текст) — уйдёт строкой «Причина». */
  error?: unknown;
  /** Доп. строки: { "Заказ": "#1234", "Статус": 502 }. Без личных данных. */
  details?: Record<string, unknown>;
  /** Страница или адрес запроса. */
  path?: string;
  /** Что считать «той же самой» ошибкой. По умолчанию — раздел + заголовок + причина. */
  dedupeKey?: string;
};

/**
 * Отправляет сообщение об ошибке. Никогда не бросает исключений и не ждёт дольше ~4 секунд,
 * поэтому её можно спокойно вызывать в catch-блоках обработчиков.
 */
export async function reportProblem(report: ProblemReport): Promise<void> {
  try {
    const token = (process.env.TELEGRAM_ALERTS_BOT_TOKEN || process.env.TELEGRAM_ORDER_BOT_TOKEN || "").trim();
    const chats = parseChatIds(process.env.TELEGRAM_ALERTS_CHAT_ID || process.env.TELEGRAM_ORDER_CHAT_ID);
    const reason = scrub(errorText(report.error)).slice(0, 700);

    // В журнал Vercel пишем всегда — даже если в Telegram не отправим.
    console.error(`[alert] ${report.area}: ${report.title}${reason ? ` | ${reason}` : ""}`);

    if (!token || !chats.length) return;
    if (process.env.NODE_ENV !== "production") return; // локальная разработка — без сообщений
    if (process.env.NEXT_PHASE === "phase-production-build") return; // сборка на Vercel — не настоящие ошибки

    const key = fingerprint(report.dedupeKey ?? `${report.area}|${report.title}|${reason.slice(0, 160)}`);
    const env = IS_STAGING ? "test" : "prod";
    const repeat = await rateLimit(`alert:${env}:${key}`, 1, REPEAT_WINDOW_MS);
    if (!repeat.ok) return;
    const cap = await rateLimit(`alert:${env}:all`, HOURLY_CAP, 60 * 60_000);
    if (!cap.ok) return;

    const icon = CRITICAL.has(report.area) ? "🔴" : "🟡";
    const lines: string[] = [];
    if (IS_STAGING) lines.push("🧪 <b>ТЕСТОВЫЙ САЙТ</b>");
    lines.push(`${icon} <b>${escapeHtml(AREA_LABEL[report.area])}</b>`);
    lines.push(escapeHtml(report.title, 300));
    lines.push("");
    if (reason) lines.push(`<b>Причина:</b> <code>${escapeHtml(reason)}</code>`);
    for (const [k, v] of Object.entries(report.details ?? {})) {
      if (v === undefined || v === null || v === "") continue;
      lines.push(`<b>${escapeHtml(k, 60)}:</b> ${escapeHtml(scrub(String(v)), 300)}`);
    }
    if (report.path) lines.push(`<b>Где:</b> ${escapeHtml(scrub(report.path), 200)}`);
    lines.push(`<b>Когда:</b> ${moscowTime()} МСК`);
    lines.push("");
    lines.push("<i>Повторы этой же ошибки в ближайшие 30 минут не присылаю.</i>");

    const text = lines.join("\n");
    await Promise.allSettled(
      chats.map((chatId) =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
          signal: AbortSignal.timeout(4000),
        })
      )
    );
  } catch (e) {
    console.error("[alert] не удалось отправить:", e instanceof Error ? e.message : e);
  }
}
