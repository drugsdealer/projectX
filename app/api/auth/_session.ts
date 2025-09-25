import crypto from "crypto";
import { NextResponse } from "next/server";

type Session = { userId: string; expires: number };

declare global {
  // eslint-disable-next-line no-var
  var __SESSIONS__: Map<string, Session> | undefined;
}

export const SESSIONS: Map<string, Session> =
  global.__SESSIONS__ ?? (global.__SESSIONS__ = new Map());

export const SESSION_COOKIE = "sid";

export function createSession(userId: string, maxAgeDays = 30) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = Date.now() + maxAgeDays * 24 * 60 * 60 * 1000;
  SESSIONS.set(token, { userId, expires });
  const cookie = serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeDays * 24 * 60 * 60,
  });
  return { token, cookie };
}

export function getSessionTokenFromRequest(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] || null;
}

export function getUserIdBySession(token: string | null) {
  if (!token) return null;
  const s = SESSIONS.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) {
    SESSIONS.delete(token);
    return null;
  }
  return s.userId;
}

export function destroySession(token: string | null) {
  if (!token) return;
  SESSIONS.delete(token);
}

function serializeCookie(name: string, value: string, opts: {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  maxAge?: number;
} = {}) {
  const p: string[] = [`${name}=${value}`];
  if (opts.maxAge) p.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) p.push(`Path=${opts.path}`);
  if (opts.httpOnly) p.push("HttpOnly");
  if (opts.secure) p.push("Secure");
  if (opts.sameSite) p.push(`SameSite=${opts.sameSite}`);
  return p.join("; ");
}

export function withSessionCookie(res: NextResponse, cookie: string) {
  res.headers.append("Set-Cookie", cookie);
  return res;
}
