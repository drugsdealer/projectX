import crypto from "crypto";
import { NextResponse } from "next/server";

// In-memory session model. NOTE: suitable for dev/preview only.
// In production use a persistent/session store (DB/Redis/etc.).
export type Session = { userId: string; expires: number };

declare global {
  // eslint-disable-next-line no-var
  var __SESSIONS__: Map<string, Session> | undefined;
}

export const SESSIONS: Map<string, Session> =
  global.__SESSIONS__ ?? (global.__SESSIONS__ = new Map());

export const SESSION_COOKIE = "sid";
const SESSION_MAX_AGE_DAYS_DEFAULT = 30;

function pruneExpired() {
  const now = Date.now();
  SESSIONS.forEach((s, token) => {
    if (s.expires <= now) {
      SESSIONS.delete(token);
    }
  });
}

/** Create a new session and return both token and ready-to-use cookie string */
export function createSession(userId: string | number, maxAgeDays = SESSION_MAX_AGE_DAYS_DEFAULT) {
  pruneExpired();
  const token = crypto.randomBytes(32).toString("hex");
  const expires = Date.now() + maxAgeDays * 24 * 60 * 60 * 1000;
  SESSIONS.set(token, { userId: String(userId), expires });
  const cookie = serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeDays * 24 * 60 * 60,
  });
  return { token, cookie };
}

/** Read our session token from a Request */
export function getSessionTokenFromRequest(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] || null;
}

/** Resolve user id by session token (with expiry check) */
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

/** Convenience: get numeric userId straight from a Request */
export function getUserIdFromRequest(req: Request): number | null {
  const token = getSessionTokenFromRequest(req);
  const uid = getUserIdBySession(token);
  const n = Number(uid);
  return Number.isFinite(n) ? n : null;
}

export function destroySession(token: string | null) {
  if (!token) return;
  SESSIONS.delete(token);
}

function serializeCookie(
  name: string,
  value: string,
  opts: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    path?: string;
    maxAge?: number;
  } = {}
) {
  const p: string[] = [`${name}=${value}`];
  if (opts.maxAge) p.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) p.push(`Path=${opts.path}`);
  if (opts.httpOnly) p.push("HttpOnly");
  if (opts.secure) p.push("Secure");
  if (opts.sameSite) p.push(`SameSite=${opts.sameSite}`);
  return p.join("; ");
}

/**
 * Low-level helper: append a pre-built cookie header to response.
 * Prefer setSessionCookie() for new code.
 */
export function withSessionCookie(res: NextResponse, cookie: string) {
  res.headers.append("Set-Cookie", cookie);
  return res;
}

/** High-level: set our session cookie using NextResponse.cookies API */
export function setSessionCookie(
  res: NextResponse,
  token: string,
  opts?: { maxAgeDays?: number }
) {
  const maxAge = (opts?.maxAgeDays ?? SESSION_MAX_AGE_DAYS_DEFAULT) * 24 * 60 * 60;
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}

/** Remove the session cookie from the browser */
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
