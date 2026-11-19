// lib/telegram.ts
import { Buffer } from "buffer";
import { IS_STAGING } from "@/lib/staging";

// С тестового сайта сообщения идут в те же чаты, но с пометкой — чтобы не спутать с настоящим заказом.
const STAGING_MARK = "🧪 <b>ТЕСТОВЫЙ САЙТ</b> — не настоящая заявка\n\n";

// Получателей у бота может быть несколько: в переменной через запятую ("111,222").
// Каждый должен один раз нажать /start в боте — иначе Telegram не даст ему написать.
function parseChatIds(value?: string) {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Бот для заказов
const ORDER_BOT_TOKEN = process.env.TELEGRAM_ORDER_BOT_TOKEN;
const ORDER_CHAT_IDS = parseChatIds(process.env.TELEGRAM_ORDER_CHAT_ID);

// Бот для консьержа
const CONCIERGE_BOT_TOKEN = process.env.TELEGRAM_CONCIERGE_BOT_TOKEN;
const CONCIERGE_CHAT_IDS = parseChatIds(process.env.TELEGRAM_CONCIERGE_CHAT_ID);

function escapeTelegramHtml(value: unknown, maxLength = 1000) {
  return String(value ?? "")
    .slice(0, maxLength)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Базовая отправка текста
async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  if (!botToken || !chatId) {
    console.error("[telegram] no token or chat id", { botToken: !!botToken, chatId: !!chatId });
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: IS_STAGING ? STAGING_MARK + text : text,
        parse_mode: "HTML",
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || (data && data.ok === false)) {
      console.error("[telegram] sendMessage failed", {
        status: res.status,
        statusText: res.statusText,
        data,
      });
    }
  } catch (err) {
    console.error("[telegram] exception while sending message:", err);
  }
}

// Рассылка всем получателям бота параллельно: сбой у одного не мешает остальным.
async function sendToAll(botToken: string | undefined, chatIds: string[], send: (chatId: string) => Promise<void>) {
  if (!botToken || !chatIds.length) {
    console.error("[telegram] no token or chat id", { botToken: !!botToken, chatIds: chatIds.length });
    return;
  }
  await Promise.allSettled(chatIds.map((chatId) => send(chatId)));
}

// ===================
//   ЗАКАЗЫ (как было)
// ===================

export async function sendOrderNotificationToTelegram(payload: {
  orderId: number | string;
  token?: string | null;
  amount: number;
  fullName?: string;
  phone?: string;
  email?: string;
}) {
  const { orderId, amount, fullName, phone, email } = payload;

  const lines: string[] = [];
  lines.push("🆕 <b>Новый заказ</b>");
  lines.push("");
  lines.push(`<b>Номер заказа:</b> ${escapeTelegramHtml(orderId, 80)}`);
  lines.push(`<b>Сумма:</b> ${escapeTelegramHtml(amount.toLocaleString("ru-RU"), 40)} ₽`);
  if (fullName) lines.push(`<b>Имя:</b> ${escapeTelegramHtml(fullName, 160)}`);
  if (phone) lines.push(`<b>Телефон:</b> ${escapeTelegramHtml(phone, 80)}`);
  if (email) lines.push(`<b>Email:</b> ${escapeTelegramHtml(email, 160)}`);

  const text = lines.join("\n");

  await sendToAll(ORDER_BOT_TOKEN, ORDER_CHAT_IDS, (chatId) => sendTelegramMessage(ORDER_BOT_TOKEN as string, chatId, text));
}

export async function sendDeliveryRequestToTelegram(payload: {
  orderNumber: number | string;
  fullName: string;
  address: string;
  scheduledAt: string;
  phone?: string;
}) {
  const { orderNumber, fullName, address, scheduledAt, phone } = payload;
  const lines: string[] = [];
  lines.push("🚚 <b>Запрос доставки на дом</b>");
  lines.push("");
  lines.push(`<b>Заказ:</b> ${escapeTelegramHtml(orderNumber, 80)}`);
  lines.push(`<b>ФИО:</b> ${escapeTelegramHtml(fullName, 160)}`);
  lines.push(`<b>Адрес:</b> ${escapeTelegramHtml(address, 500)}`);
  lines.push(`<b>Время:</b> ${escapeTelegramHtml(scheduledAt, 120)}`);
  if (phone) lines.push(`<b>Телефон:</b> ${escapeTelegramHtml(phone, 80)}`);

  const text = lines.join("\n");
  await sendToAll(ORDER_BOT_TOKEN, ORDER_CHAT_IDS, (chatId) => sendTelegramMessage(ORDER_BOT_TOKEN as string, chatId, text));
}

// ============================
//   КОНСЬЕРЖ + ВЛОЖЕНИЯ
// ============================

// Тип файла, который приходит из фронта
export type ConciergeAttachment = {
  name: string;
  type: string;
  data: string; // base64 без "data:...;base64,"
};

// Отправка одного файла как документа в Telegram
async function sendTelegramDocument(
  botToken: string,
  chatId: string,
  file: ConciergeAttachment,
  caption?: string
) {
  if (!botToken || !chatId) return;
  if (!file?.data) return;

  try {
    const binary = Buffer.from(file.data, "base64");
    const blob = new Blob([binary], {
      type: file.type || "application/octet-stream",
    });

    const form = new FormData();
    form.append("chat_id", chatId);
    const finalCaption = IS_STAGING ? `🧪 ТЕСТОВЫЙ САЙТ${caption ? ` — ${caption}` : ""}` : caption;
    if (finalCaption) form.append("caption", finalCaption);
    form.append("document", blob, file.name || "file");

    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      {
        method: "POST",
        body: form,
      }
    );

    const data = await res.json().catch(() => null);
    if (!res.ok || (data && data.ok === false)) {
      console.error("[telegram] sendDocument failed", {
        status: res.status,
        statusText: res.statusText,
        data,
      });
    }
  } catch (err) {
    console.error("[telegram] exception while sending document:", err);
  }
}

// Основная функция: текст + реальные файлы
export async function sendConciergeRequestToTelegram(payload: {
  text: string;
  attachments?: ConciergeAttachment[];
}) {
  const { text, attachments } = payload;

  await sendToAll(CONCIERGE_BOT_TOKEN, CONCIERGE_CHAT_IDS, async (chatId) => {
    // 1) текст
    await sendTelegramMessage(CONCIERGE_BOT_TOKEN as string, chatId, text);

    // 2) файлы — отдельными сообщениями
    for (const file of attachments ?? []) {
      try {
        await sendTelegramDocument(CONCIERGE_BOT_TOKEN as string, chatId, file);
      } catch (e) {
        console.error("[telegram] failed to send concierge attachment", e);
      }
    }
  });
} 
