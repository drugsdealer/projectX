import { createHash, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Подтверждение телефона кодом.
 *
 * Доставка: сначала пробуем Telegram — сообщение там дешевле СМС в сотни раз.
 * Если Telegram отвечает, что доставить не может (нет аккаунта на этом номере,
 * закрыты настройки, сбой) — уходим в СМС. Порядок задаётся в одном месте.
 *
 * Код нигде не хранится в открытом виде: в базе лежит только отпечаток.
 */

export const CODE_TTL_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 5;
export const MAX_SENDS_PER_HOUR = 5;

export type Channel = "telegram" | "sms";

export function normalizePhone(raw: string): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  if (d.length !== 11 || !d.startsWith("7")) return null;
  return "+" + d;
}

function hashCode(phone: string, code: string) {
  const pepper = process.env.STAGE_VAULT_SECRET || "";
  return createHash("sha256").update(`${phone}:${code}:${pepper}`).digest("hex");
}

function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/* ---------- доставка ---------- */

async function sendViaTelegram(phone: string, code: string): Promise<boolean> {
  const token = process.env.TELEGRAM_GATEWAY_TOKEN?.trim();
  if (!token) return false;

  const call = async (method: string, body: Record<string, unknown>) => {
    const res = await fetch(`https://gatewayapi.telegram.org/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return (await res.json().catch(() => null)) as any;
  };

  try {
    // Спрашиваем заранее: ответ приходит до списания денег.
    const able = await call("checkSendAbility", { phone_number: phone });
    if (!able?.ok) return false;

    const sent = await call("sendVerificationMessage", {
      phone_number: phone,
      code,
      code_length: code.length,
      ttl: Math.floor(CODE_TTL_MS / 1000),
    });
    return Boolean(sent?.ok);
  } catch {
    return false;
  }
}

async function sendViaSms(phone: string, code: string): Promise<boolean> {
  const apiId = process.env.SMSRU_API_ID?.trim();
  if (!apiId) return false;
  try {
    const url = new URL("https://sms.ru/sms/send");
    url.searchParams.set("api_id", apiId);
    url.searchParams.set("to", phone.replace("+", ""));
    url.searchParams.set("msg", `Код подтверждения Stage Store: ${code}`);
    url.searchParams.set("json", "1");
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = (await res.json().catch(() => null)) as any;
    return data?.status === "OK";
  } catch {
    return false;
  }
}

/* ---------- основной сценарий ---------- */

export type SendResult =
  | { ok: true; channel: Channel }
  | { ok: false; reason: "rate_limited" | "no_channel" | "invalid_phone" };

export async function sendPhoneCode(rawPhone: string): Promise<SendResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  const existing = await prisma.phoneVerification.findUnique({ where: { phone } });
  const hourAgo = new Date(Date.now() - 3_600_000);
  if (existing && existing.createdAt > hourAgo && existing.sendCount >= MAX_SENDS_PER_HOUR) {
    return { ok: false, reason: "rate_limited" };
  }

  const code = generateCode();
  let channel: Channel | null = null;

  if (await sendViaTelegram(phone, code)) channel = "telegram";
  else if (await sendViaSms(phone, code)) channel = "sms";

  if (!channel) return { ok: false, reason: "no_channel" };

  const data = {
    codeHash: hashCode(phone, code),
    channel,
    attempts: 0,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    verifiedAt: null,
  };
  await prisma.phoneVerification.upsert({
    where: { phone },
    update: {
      ...data,
      sendCount: existing && existing.createdAt > hourAgo ? existing.sendCount + 1 : 1,
      createdAt: existing && existing.createdAt > hourAgo ? existing.createdAt : new Date(),
    },
    create: { phone, ...data, sendCount: 1 },
  });

  return { ok: true, channel };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "too_many" | "wrong" };

export async function verifyPhoneCode(rawPhone: string, rawCode: string): Promise<VerifyResult> {
  const phone = normalizePhone(rawPhone);
  const code = String(rawCode ?? "").replace(/\D/g, "");
  if (!phone || code.length !== 6) return { ok: false, reason: "wrong" };

  const rec = await prisma.phoneVerification.findUnique({ where: { phone } });
  if (!rec) return { ok: false, reason: "not_found" };
  if (rec.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (rec.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

  const expected = Buffer.from(rec.codeHash, "hex");
  const got = Buffer.from(hashCode(phone, code), "hex");
  const match = expected.length === got.length && timingSafeEqual(expected, got);

  if (!match) {
    const attempts = rec.attempts + 1;
    await prisma.phoneVerification.update({ where: { phone }, data: { attempts } });
    return { ok: false, reason: attempts >= MAX_ATTEMPTS ? "too_many" : "wrong" };
  }

  await prisma.phoneVerification.update({
    where: { phone },
    data: { verifiedAt: new Date(), attempts: 0 },
  });
  return { ok: true };
}

/** Телефон подтверждён и подтверждение ещё свежее (полчаса). */
export async function isPhoneVerified(rawPhone: string): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return false;
  const rec = await prisma.phoneVerification.findUnique({ where: { phone } });
  if (!rec?.verifiedAt) return false;
  return Date.now() - rec.verifiedAt.getTime() < 30 * 60_000;
}
