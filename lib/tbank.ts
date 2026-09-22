import { createHash } from "crypto";

/**
 * Эквайринг T-Bank (бывш. Тинькофф), сценарий non-PCI:
 * сервер вызывает Init → получает PaymentURL → пользователь платит на форме банка.
 *
 * Карточные данные через наш сервер НЕ проходят (поэтому non-PCI).
 */

const TBANK_API_DEFAULT = "https://securepay.tinkoff.ru/v2";

/**
 * Банк не отвечает на запросы с зарубежных адресов. Когда сайт размещён вне России,
 * запросы идут через свой сервер-посредник в РФ: TBANK_API_BASE указывает на него,
 * TBANK_PROXY_SECRET закрывает посредника от посторонних.
 * Без этих переменных обращаемся в банк напрямую.
 */
function getTBankApi() {
  const base = process.env.TBANK_API_BASE?.trim();
  return (base ? base.replace(/\/+$/, "") : TBANK_API_DEFAULT);
}

function tbankHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.TBANK_PROXY_SECRET?.trim();
  if (secret) headers["X-Proxy-Secret"] = secret;
  return headers;
}

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
  /** Данные для фискального чека по 54-ФЗ */
  receiptEmail?: string | null;
  receiptPhone?: string | null;
  receiptItems?: TBankReceiptItem[];
};

export type InitResult =
  | { ok: true; paymentUrl: string; paymentId: string; status: string }
  | { ok: false; message: string; errorCode?: string };

/** Создаёт платёж и возвращает ссылку на платёжную форму банка. */
/**
 * Чек по 54-ФЗ. Без него боевая касса не сформирует фискальный чек,
 * а покупатель и налоговая его не получат.
 * Taxation берём из настройки: у ИП на УСН «Доходы» это usn_income.
 */
export type TBankReceiptItem = {
  name: string;
  priceKopecks: number;
  quantity: number;
};

function buildReceipt(p: {
  email?: string | null;
  phone?: string | null;
  items: TBankReceiptItem[];
  totalKopecks: number;
}) {
  const taxation = process.env.TBANK_TAXATION?.trim() || "usn_income";

  let items = p.items
    .filter((i) => i.quantity > 0 && i.priceKopecks > 0)
    .map((i) => ({
      Name: i.name.slice(0, 128),
      Price: i.priceKopecks,
      Quantity: i.quantity,
      Amount: i.priceKopecks * i.quantity,
      Tax: "none",
      PaymentMethod: "full_payment",
      PaymentObject: "commodity",
    }));

  // Сумма позиций обязана совпадать с суммой платежа, иначе касса отклонит чек.
  // Скидки и промокоды легко ломают это равенство — тогда пробиваем одной строкой.
  const sum = items.reduce((acc, i) => acc + i.Amount, 0);
  if (!items.length || sum !== p.totalKopecks) {
    items = [
      {
        Name: "Оплата заказа",
        Price: p.totalKopecks,
        Quantity: 1,
        Amount: p.totalKopecks,
        Tax: "none",
        PaymentMethod: "full_payment",
        PaymentObject: "commodity",
      },
    ];
  }

  const receipt: Record<string, unknown> = { Taxation: taxation, Items: items };
  if (p.email) receipt.Email = p.email;
  if (p.phone) receipt.Phone = p.phone;
  return receipt;
}

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

  // Подпись считается ДО добавления чека: вложенные объекты в неё не входят.
  payload.Token = buildTBankToken(payload, cfg.password);

  if (p.receiptItems || p.receiptEmail || p.receiptPhone) {
    payload.Receipt = buildReceipt({
      email: p.receiptEmail,
      phone: p.receiptPhone,
      items: p.receiptItems ?? [],
      totalKopecks: p.amountKopecks,
    });
  }

  try {
    const res = await fetch(`${getTBankApi()}/Init`, {
      method: "POST",
      headers: tbankHeaders(),
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
    const res = await fetch(`${getTBankApi()}/GetState`, {
      method: "POST",
      headers: tbankHeaders(),
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
