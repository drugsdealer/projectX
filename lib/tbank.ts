import { createHash } from "crypto";

/**
 * Эквайринг T-Bank (бывш. Тинькофф), сценарий non-PCI:
 * сервер вызывает Init → получает PaymentURL → пользователь платит на форме банка.
 *
 * Карточные данные через наш сервер НЕ проходят (поэтому non-PCI).
 */

const TBANK_API = "https://securepay.tinkoff.ru/v2";

export function getTBankConfig() {
  const terminalKey = process.env.TBANK_TERMINAL_KEY || "";
  const password = process.env.TBANK_PASSWORD || "";
  if (!terminalKey || !password) return null;
  return { terminalKey, password };
}

/**
 * Подпись запроса (Token).
 * Алгоритм: берём параметры ВЕРХНЕГО уровня (вложенные объекты Receipt/DATA не участвуют),
 * добавляем Password, сортируем по имени ключа, склеиваем значения и считаем SHA-256 (hex, нижний регистр).
 */
export function buildTBankToken(
  params: Record<string, unknown>,
  password: string
): string {
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === "Token") continue;
    if (value === undefined || value === null) continue;
    // Вложенные объекты/массивы (Receipt, DATA) в подписи не участвуют
    if (typeof value === "object") continue;
    flat[key] = typeof value === "boolean" ? String(value) : String(value);
  }

  flat.Password = password;

  const concatenated = Object.keys(flat)
    .sort()
    .map((k) => flat[k])
    .join("");

  return createHash("sha256").update(concatenated, "utf8").digest("hex");
}

type InitParams = {
  /** Сумма в КОПЕЙКАХ */
  amountKopecks: number;
  orderId: string;
  description?: string;
  successUrl?: string;
  failUrl?: string;
  notificationUrl?: string;
  customerKey?: string;
};

export type InitResult =
  | { ok: true; paymentUrl: string; paymentId: string; status: string }
  | { ok: false; message: string; errorCode?: string };

/** Создаёт платёж и возвращает ссылку на платёжную форму банка. */
export async function tbankInit(p: InitParams): Promise<InitResult> {
  const cfg = getTBankConfig();
  if (!cfg) return { ok: false, message: "T-Bank credentials are not configured" };

  const payload: Record<string, unknown> = {
    TerminalKey: cfg.terminalKey,
    Amount: p.amountKopecks,
    OrderId: p.orderId,
    ...(p.description ? { Description: p.description.slice(0, 250) } : {}),
    ...(p.successUrl ? { SuccessURL: p.successUrl } : {}),
    ...(p.failUrl ? { FailURL: p.failUrl } : {}),
    ...(p.notificationUrl ? { NotificationURL: p.notificationUrl } : {}),
    ...(p.customerKey ? { CustomerKey: p.customerKey } : {}),
  };

  payload.Token = buildTBankToken(payload, cfg.password);

  try {
    const res = await fetch(`${TBANK_API}/Init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const data: any = await res.json().catch(() => null);
    if (!data) return { ok: false, message: "Некорректный ответ банка" };

    if (!data.Success || !data.PaymentURL) {
      return {
        ok: false,
        message: data.Message || data.Details || "Банк отклонил создание платежа",
        errorCode: data.ErrorCode,
      };
    }

    return {
      ok: true,
      paymentUrl: String(data.PaymentURL),
      paymentId: String(data.PaymentId),
      status: String(data.Status || ""),
    };
  } catch {
    return { ok: false, message: "Не удалось связаться с банком" };
  }
}

/** Проверка реального статуса платежа на стороне банка (доверяем только этому). */
export async function tbankGetState(paymentId: string): Promise<
  { ok: true; status: string } | { ok: false; message: string }
> {
  const cfg = getTBankConfig();
  if (!cfg) return { ok: false, message: "T-Bank credentials are not configured" };

  const payload: Record<string, unknown> = {
    TerminalKey: cfg.terminalKey,
    PaymentId: paymentId,
  };
  payload.Token = buildTBankToken(payload, cfg.password);

  try {
    const res = await fetch(`${TBANK_API}/GetState`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data: any = await res.json().catch(() => null);
    if (!data || !data.Success) {
      return { ok: false, message: data?.Message || "Не удалось получить статус платежа" };
    }
    return { ok: true, status: String(data.Status || "") };
  } catch {
    return { ok: false, message: "Не удалось связаться с банком" };
  }
}

/**
 * Проверка подлинности нотификации: пересчитываем подпись из пришедших полей.
 * Без этой проверки кто угодно мог бы прислать «оплачено».
 */
export function verifyTBankNotification(body: Record<string, unknown>): boolean {
  const cfg = getTBankConfig();
  if (!cfg) return false;
  const received = typeof body.Token === "string" ? body.Token : "";
  if (!received) return false;
  const expected = buildTBankToken(body, cfg.password);
  // сравнение hex-строк одинаковой длины
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
