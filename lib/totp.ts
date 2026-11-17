import crypto from "crypto";

// Ленивый геттер ключа шифрования TOTP-секрета — проверка на рантайме, не при импорте/сборке.
function getTotpKey(): Buffer {
  const rawKey =
    process.env.ADMIN_TOTP_SECRET_KEY ||
    process.env.STAGE_VAULT_SECRET ||
    (process.env.NODE_ENV !== "production" ? "dev_insecure_key" : "");
  if (!rawKey) {
    throw new Error("ADMIN_TOTP_SECRET_KEY is required in production");
  }
  return crypto.createHash("sha256").update(rawKey).digest();
}

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getTotpKey(), iv);
  const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${enc.toString("base64")}.${tag.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, encB64, tagB64] = payload.split(".");
  if (!ivB64 || !encB64 || !tagB64) {
    throw new Error("Invalid secret payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getTotpKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

// ── TOTP (RFC 6238) на встроенном crypto ──────────────────────────────────────
// Раньше использовали otplib, но его base32-декодер (пакет thirty-two) построен на устаревшем
// `new Buffer()`. Своя реализация не зависит от версии Node.js на Vercel.
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP = 30;
const TOTP_DIGITS = 6;

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Новый секрет: 10 случайных байт → 16 символов base32 (как у otplib). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(10));
}

function totpAt(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin = h.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/**
 * Проверяет 6-значный код. Возвращает сдвиг в шагах (0 — точно в срок, ±1/±2 — часы
 * телефона спешат/отстают на 30/60 с) или null, если код не подошёл.
 */
export function verifyTotp(code: string, secret: string, window = 2, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secret);
  const counter = Math.floor(nowMs / 1000 / TOTP_STEP);
  const given = Buffer.from(code);
  for (let d = 0; d <= window; d++) {
    for (const delta of d === 0 ? [0] : [-d, d]) {
      const expected = Buffer.from(totpAt(key, counter + delta));
      if (crypto.timingSafeEqual(expected, given)) return delta;
    }
  }
  return null;
}

export function totpKeyUri(account: string, issuer: string, secret: string): string {
  const e = encodeURIComponent;
  return `otpauth://totp/${e(issuer)}:${e(account)}?secret=${secret}&period=${TOTP_STEP}&digits=${TOTP_DIGITS}&algorithm=SHA1&issuer=${e(issuer)}`;
}
