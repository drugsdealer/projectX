// app/api/auth/send-email-code/route.ts
import { NextResponse } from "next/server";

import { CODES, type CodeRecord } from "../_codes";

// Нужен Node runtime (nodemailer не работает на edge)
export const runtime = "nodejs";

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
// Extend SMTP options to include pooling/timeouts (not always present in older type defs)
type SMTPOpts = SMTPTransport.Options & {
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
};
import crypto from "crypto";

const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProd = NODE_ENV === "production";

const CONN_MS = Number(process.env.SMTP_CONN_TIMEOUT ?? 3000);
const GREET_MS = Number(process.env.SMTP_GREET_TIMEOUT ?? 3000);
const SOCK_MS = Number(process.env.SMTP_SOCKET_TIMEOUT ?? 3000);

const RATE_LIMIT = new Map<string, { lastSent: number; count: number }>();

const CODE_TTL_MS = 5 * 60 * 1000; // 5 минут
const MAX_PER_15_MIN = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 секунд

function generateCode() {
  const buf = crypto.randomBytes(4);
  const num = buf.readUInt32BE(0) % 1000000;
  return num.toString().padStart(6, "0");
}

function ok(data: any, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}
function bad(message = "Bad Request", init = 400) {
  return NextResponse.json({ success: false, message }, { status: init });
}

const withOverallTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
  let to: any;
  const timeout = new Promise<never>((_, reject) => {
    to = setTimeout(() => reject(new Error("SEND_TIMEOUT")), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(to);
  }
};

export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return bad("Некорректный email");
    }
    const normalizedEmail = email.trim().toLowerCase();

    let existingUser: any = null;
    // Ensure user exists (needed so verify-email can mark verified and start a session)
    try {
      const { getUserByEmail, upsertUser } = await import("../_users");
      existingUser = getUserByEmail(normalizedEmail);
      if (!existingUser) {
        upsertUser({ email: normalizedEmail });
        if (!isProd) {
          console.log("[SEND] created user stub", normalizedEmail);
        }
      }
    } catch (e) {
      console.error("[SEND] ensure user error:", e);
      return bad("Не удалось подготовить отправку кода", 500);
    }

    // Если пользователь уже подтвержден — письмо не отправляем
    if (existingUser?.verified) {
      if (!isProd) {
        console.log("[SEND] already verified", normalizedEmail);
      }
      return ok({ success: true, alreadyVerified: true });
    }

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    const rlKey = `${ip}:${normalizedEmail}`;
    const now = Date.now();
    const rl = RATE_LIMIT.get(rlKey);

    if (!rl || now - rl.lastSent > 15 * 60 * 1000) {
      RATE_LIMIT.set(rlKey, { lastSent: now, count: 1 });
    } else {
      if (rl.count >= MAX_PER_15_MIN) {
        return bad("Слишком много запросов. Попробуйте позже.", 429);
      }
      rl.count += 1;
      rl.lastSent = now;
      RATE_LIMIT.set(rlKey, rl);
    }

    // Проверка кулдауна
    const existingCode = CODES.get(normalizedEmail);
    if (existingCode && now - existingCode.sentAt < RESEND_COOLDOWN_MS) {
      const cooldownSec = Math.ceil((RESEND_COOLDOWN_MS - (now - existingCode.sentAt)) / 1000);
      if (!isProd) {
        console.log("[SEND] cooldown active", normalizedEmail, `${cooldownSec}s left`);
      }
      const res = NextResponse.json({ success: true, cooldown: cooldownSec });
      res.cookies.set("vfy", normalizedEmail, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 300, // 5 минут доступа к /verify-email
      });
      return res;
    }

    const code = generateCode();
    CODES.set(normalizedEmail, { code, expires: now + CODE_TTL_MS, attempts: 0, sentAt: now });

    if (!isProd) {
      console.log("[SEND] stored", normalizedEmail, code, "size:", CODES.size);
    }

    if (
      !isProd &&
      (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS)
    ) {
      console.log(`[DEV] Verification code for ${normalizedEmail}: ${code}`);
      const res = NextResponse.json({ success: true, devCode: code });
      res.cookies.set("vfy", normalizedEmail, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 300,
      });
      return res;
    }

    // --- Robust SMTP config (works with Mailtrap/Gmail/etc.)
    const host = process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io";
    const port = Number(process.env.SMTP_PORT ?? 2525);

    // If SMTP_SECURE is explicitly set, respect it; otherwise infer from port
    const secure =
      process.env.SMTP_SECURE !== undefined
        ? String(process.env.SMTP_SECURE).toLowerCase() === "true"
        : port === 465;

    if (!isProd) {
      console.log("[SMTP] config", { host, port, secure });
    }

    const smtpOptions: SMTPOpts = {
      host,
      port,
      secure, // true for 465, false for 587/25 with STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 1,
      maxMessages: 50,
      connectionTimeout: CONN_MS,
      greetingTimeout: GREET_MS,
      socketTimeout: SOCK_MS,
      // Optionally relax TLS in dev if your environment breaks certs:
      ...(process.env.SMTP_TLS_INSECURE === "true"
        ? { tls: { rejectUnauthorized: false } }
        : {}),
    };

    const transporter = nodemailer.createTransport<SMTPTransport.SentMessageInfo>(smtpOptions);


    // Ретраи отправки письма
    const sendWithRetry = async (attempt = 1): Promise<void> => {
      try {
        await transporter.sendMail({
          from: process.env.MAIL_FROM || '"Auth Bot" <noreply@example.com>',
          to: email,
          subject: "Ваш код подтверждения",
          text: `Ваш код: ${code}\nКод действителен 5 минут.`,
          html: `<p>Ваш код: <b>${code}</b></p><p>Код действителен 5 минут.</p>`,
        });
      } catch (e: any) {
        const retriable = ["ECONNECTION", "ETIMEDOUT", "ECONNRESET"].includes(e?.code);
        if (retriable && attempt < 3) {
          const delay = 400 * attempt;
          if (!isProd) {
            console.warn(`[SMTP] sendMail failed (attempt ${attempt}), retrying in ${delay}ms`);
          }
          await new Promise(r => setTimeout(r, delay));
          return sendWithRetry(attempt + 1);
        }
        throw e;
      }
    };

    if (!isProd) {
      // Fire-and-forget в DEV, чтобы не ждать сеть (быстрое UX)
      sendWithRetry().catch((e) => console.warn("[SMTP] DEV async send failed:", e?.code || e));
      const res = NextResponse.json({ success: true, devCode: code, message: "DEV: код отправлен и показан здесь" });
      res.cookies.set("vfy", normalizedEmail, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 300,
      });
      return res;
    }

    try {
      // В PROD ограничиваем общее ожидание 3 сек
      await withOverallTimeout(sendWithRetry(), 3000);
    } catch (e) {
      console.error("[SMTP] sendMail error (prod):", (e as any)?.code || e);
      // В проде не раскрываем код, но не падаем 500 — просим повторить позже
      const res = NextResponse.json({ success: false, message: "Мы отправили код, но доставка может занять время. Если письма нет — попробуйте отправить ещё раз." }, { status: 200 });
      res.cookies.set("vfy", normalizedEmail, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 300,
      });
      return res;
    }

    if (!isProd) {
      console.log(`[DEV] Code for ${normalizedEmail} sent via SMTP: ${code}`);
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set("vfy", normalizedEmail, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
    return res;
  } catch (e) {
    console.error(e);
    return bad("Не удалось отправить код. Повторите позже.", 500);
  }
}