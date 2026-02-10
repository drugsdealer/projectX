import crypto from "crypto";

const RAW_KEY =
  process.env.ADMIN_TOTP_SECRET_KEY ||
  process.env.STAGE_VAULT_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev_insecure_key" : "");

if (!RAW_KEY) {
  throw new Error("ADMIN_TOTP_SECRET_KEY is required in production");
}

const KEY = crypto.createHash("sha256").update(RAW_KEY).digest();

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
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
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
