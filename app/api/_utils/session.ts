import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Normalize Next 15 async cookies() to a plain jar
async function getCookieJar(): Promise<any> {
  const c: any = cookies() as any;
  if (typeof c?.then === 'function') {
    return await c;
  }
  return c;
}

/**
 * Unified auth session utilities
 *
 * \- Primary httpOnly cookie: `session_user_id` (stores numeric user id as string)
 * \- Legacy support: signed token cookie `auth_session` (uid.ts.nonce.sig)
 * \- UI helper cookies for client hydration: `ui_user_data`, `ui_fullname`
 */

// ===== Cookie names =====
export const SESSION_COOKIE = 'session_user_id'; // primary
export const SESSION_TOKEN_COOKIE = 'session_token'; // persistent session token
export const LEGACY_AUTH_COOKIE = 'auth_session'; // legacy fallback
export const UI_USER_COOKIE = 'ui_user_data';
export const UI_FULLNAME_COOKIE = 'ui_fullname';
export const GUEST_TOKEN_COOKIE = 'guest_order_token'; // canonical name used by checkout
export const GUEST_TOKEN_COOKIE_ALT = 'guest_token';   // backward compatibility with older code
export const PENDING_ORDER_COOKIE = 'pending_order_id';

// Secret for legacy token signature (HMAC-SHA256). Set STAGE_VAULT_SECRET in .env
const SECRET = process.env.STAGE_VAULT_SECRET || 'dev_secret_change_me';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Use secure cookies in production
const isProd = process.env.NODE_ENV === 'production';

// Note: In Next 15, `cookies()` can be async; use getCookieJar() in helpers below.

// ===== Internal helpers (legacy token) =====
function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sign(payload: string) {
  return base64url(createHmac('sha256', SECRET).update(payload).digest());
}

/** Make a signed legacy session token for given userId (used only for backward compat) */
export function makeToken(userId: string | number) {
  const uid = String(userId);
  const ts = Date.now().toString();
  const nonce = base64url(randomBytes(8));
  const payload = `${uid}.${ts}.${nonce}`;
  const sig = sign(payload);
  return `${payload}.${sig}`; // uid.ts.nonce.sig
}

/** Verify legacy token signature and return userId or null */
export function parseToken(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [uid, ts, nonce, sig] = parts;
  const expected = sign(`${uid}.${ts}.${nonce}`);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return uid;
}

/**
 * Set primary auth session cookie with plain user id. Prefer setSessionOnResponse in route handlers.
 */
export async function setSession(userId: string | number) {
  try {
    const jar: any = await getCookieJar();
    jar.set({
      name: SESSION_COOKIE,
      value: String(userId),
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: MAX_AGE,
    });
  } catch {
    // If called from a Server Component, cookies().set is unavailable.
    // Use setSessionOnResponse(res, userId) in route handlers.
  }
}

/** Same as setSession, but attaches cookie to a provided NextResponse (useful in API routes) */
export function setSessionOnResponse(res: NextResponse, userId: string | number) {
  res.cookies.set(
    SESSION_COOKIE,
    String(userId),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: MAX_AGE,
    },
  );
  return res;
}

/** Attach session token cookie (used to validate active sessions) */
export function setSessionTokenOnResponse(res: NextResponse, token: string) {
  res.cookies.set(
    SESSION_TOKEN_COOKIE,
    token,
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: MAX_AGE,
    },
  );
  return res;
}

export function clearSessionTokenOnResponse(res: NextResponse) {
  try {
    res.cookies.set(SESSION_TOKEN_COOKIE, '', { path: '/', maxAge: 0 });
  } catch {}
  return res;
}

/** Clear session cookies on the provided response */
export function clearSessionOnResponse(res: NextResponse) {
  try {
    res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    res.cookies.set(LEGACY_AUTH_COOKIE, '', { path: '/', maxAge: 0 });
    res.cookies.set(SESSION_TOKEN_COOKIE, '', { path: '/', maxAge: 0 });
  } catch {}
  return res;
}

/** Clear both primary and legacy auth cookies (best-effort). Prefer clearSessionOnResponse in route handlers. */
export async function clearSession() {
  try {
    const jar: any = await getCookieJar();
    jar.set({ name: SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
    jar.set({ name: LEGACY_AUTH_COOKIE, value: '', path: '/', maxAge: 0 });
    jar.set({ name: SESSION_TOKEN_COOKIE, value: '', path: '/', maxAge: 0 });
  } catch {
    // noop
  }
}

/** Read guest order token from cookie (for unauthenticated orders) */
export async function getGuestToken(): Promise<string | null> {
  const jar: any = await getCookieJar();
  const v = jar.get(GUEST_TOKEN_COOKIE)?.value ?? jar.get(GUEST_TOKEN_COOKIE_ALT)?.value;
  return v ?? null;
}

/** Set guest order token cookie (httpOnly). Prefer setGuestTokenOnResponse in route handlers. */
export async function setGuestToken(token: string) {
  try {
    const jar: any = await getCookieJar();
    jar.set({
      name: GUEST_TOKEN_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: MAX_AGE,
    });
    jar.set({
      name: GUEST_TOKEN_COOKIE_ALT,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: MAX_AGE,
    });
  } catch {
    // If not in a route handler, write via setGuestTokenOnResponse instead.
  }
}

/** Set guest order token on a provided response (httpOnly) */
export function setGuestTokenOnResponse(res: NextResponse, token: string) {
  res.cookies.set(GUEST_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: MAX_AGE,
  });
  res.cookies.set(GUEST_TOKEN_COOKIE_ALT, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: MAX_AGE,
  });
  return res;
}

/** Ensure guest token is present on response; returns existing or newly created token */
export function ensureGuestToken(res: NextResponse): string {
  // try already set on this response
  const already = res.cookies.get(GUEST_TOKEN_COOKIE)?.value || res.cookies.get(GUEST_TOKEN_COOKIE_ALT)?.value;
  if (already) return already;

  // otherwise generate a new one and set both canonical and legacy names
  const token = (globalThis.crypto?.randomUUID?.() as string) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  setGuestTokenOnResponse(res, token);
  return token;
}

/** Clear guest order token cookies (both canonical and legacy). Prefer using response-based variant in routes. */
export async function clearGuestToken() {
  try {
    const jar: any = await getCookieJar();
    jar.set({ name: GUEST_TOKEN_COOKIE, value: '', path: '/', maxAge: 0 });
    jar.set({ name: GUEST_TOKEN_COOKIE_ALT, value: '', path: '/', maxAge: 0 });
  } catch {
    // noop
  }
}

/** Read userId from cookies: primary first, then legacy fallback */
export async function getSessionUserId(): Promise<string | null> {
  const jar: any = await getCookieJar();

  const sessionToken = jar.get(SESSION_TOKEN_COOKIE)?.value;
  if (sessionToken) {
    try {
      const session = await prisma.userSession.findUnique({
        where: { token: sessionToken },
        select: { userId: true, revokedAt: true, lastSeen: true },
      });
      if (!session || session.revokedAt) {
        // keep session_user_id as fallback
        jar.set({ name: SESSION_TOKEN_COOKIE, value: '', path: '/', maxAge: 0 });
        return null;
      }
      const now = Date.now();
      if (!session.lastSeen || now - session.lastSeen.getTime() > 5 * 60 * 1000) {
        prisma.userSession.update({
          where: { token: sessionToken },
          data: { lastSeen: new Date() },
        }).catch(() => {});
      }
      return String(session.userId);
    } catch {
      // БД недоступна — игнорируем session_token и продолжаем
    }
  }

  const id = jar.get(SESSION_COOKIE)?.value;
  if (id && id.trim() !== '') return id;

  const legacyRaw = jar.get(LEGACY_AUTH_COOKIE)?.value || null;
  const legacyId = parseToken(legacyRaw);
  return legacyId ?? null;
}


/** Get numeric user id from session cookie (`session_user_id`) */
export async function getUserId(): Promise<number | null> {
  const id = await getSessionUserId();
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

// Optional alias for compatibility with old imports
export { getSessionUserId as getSessionUserIdRaw };
// Async aliases for backward compatibility
export async function getSessionUserIdAsync() { return await getSessionUserId(); }
export async function getUserIdAsync() { return await getUserId(); }

// ===== UI helper cookies (non-critical, for client hydration only) =====

/** Attach lightweight UI cookies (non-HTTPOnly) to response */
export function attachUiCookies(res: NextResponse, ui: any): NextResponse {
  try {
    const payload = JSON.stringify(ui ?? {});
    res.cookies.set(UI_USER_COOKIE, encodeURIComponent(payload), {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: isProd,
      maxAge: MAX_AGE,
    });

    const fullName =
      typeof ui?.fullName === 'string'
        ? ui.fullName
        : typeof ui?.name === 'string'
        ? ui.name
        : '';
    res.cookies.set(UI_FULLNAME_COOKIE, encodeURIComponent(fullName), {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: isProd,
      maxAge: MAX_AGE,
    });
  } catch {}
  return res;
}

/** Clear UI cookies */
export function clearUiCookies(res: NextResponse): NextResponse {
  try {
    res.cookies.set(UI_USER_COOKIE, '', { path: '/', maxAge: 0 });
    res.cookies.set(UI_FULLNAME_COOKIE, '', { path: '/', maxAge: 0 });
  } catch {}
  return res;
}

// ===== Optional: tiny helpers for reading UI cookies on server if нужно =====
export async function readUiUserFromCookie<T = any>(): Promise<T | null> {
  try {
    const jar: any = await getCookieJar();
    const raw = jar.get(UI_USER_COOKIE)?.value;
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

// --- Server-side helper to fetch full user by session ---
import { prisma } from '@/lib/prisma';

/** Validate that user exists and is not soft-deleted */
export async function validateUserBySession(userId: number | null) {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      const jar: any = await getCookieJar();
      jar.set({ name: SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
      jar.set({ name: LEGACY_AUTH_COOKIE, value: '', path: '/', maxAge: 0 });
      console.warn(`⚠️ Сессия недействительна или профиль деактивирован: userId=${userId}`);
      return null;
    }
    return user.id;
  } catch (err) {
    console.error("[validateUserBySession] Ошибка проверки пользователя:", err);
    return null;
  }
}

export async function getUserFromSession() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const numericId = Number(userId);
  if (isNaN(numericId)) return null;

  const validUserId = await validateUserBySession(numericId);
  if (!validUserId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: validUserId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        address: true,
        city: true,
        gender: true,
        birthDate: true,
        avatarEmoji: true,
        verified: true,
      },
    });
    return user;
  } catch (e) {
    console.error('[getUserFromSession] DB error', e);
    return null;
  }
}

/** Read numeric user id directly from a Request's Cookie header (compat helper) */
export function getUserIdFromRequest(req: Request): number | null {
  try {
    const cookie = req.headers.get('cookie') ?? '';
    const sm = cookie.match(new RegExp(`${SESSION_TOKEN_COOKIE}=([^;]+)`));
    if (sm?.[1]) return null; // session_token requires async validation; use getSessionUserId instead
    const m = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    if (!m) return null;
    const n = Number(decodeURIComponent(m[1]));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Read guest token directly from a Request's Cookie header (compat helper) */
export function getGuestTokenFromRequest(req: Request): string | null {
  try {
    const cookie = req.headers.get('cookie') ?? '';
    const m = cookie.match(new RegExp(`${GUEST_TOKEN_COOKIE}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/** Convenience: extract auth context from Request cookies */
export function extractAuthFromRequest(req: Request): { userId: number | null; token: string | null } {
  const userId = getUserIdFromRequest(req);
  // try canonical and legacy guest token names
  const cookie = req.headers.get('cookie') ?? '';
  let token: string | null = null;
  try {
    const m1 = cookie.match(new RegExp(`${GUEST_TOKEN_COOKIE}=([^;]+)`));
    const m2 = cookie.match(new RegExp(`${GUEST_TOKEN_COOKIE_ALT}=([^;]+)`));
    token = m1 ? decodeURIComponent(m1[1]) : m2 ? decodeURIComponent(m2[1]) : null;
  } catch {}
  return { userId, token };
}

/**
 * Pending order helpers: we persist last created order id for payment flow.
 * API routes can set it and then read it as a fallback if bank UI didn't carry the id.
 */
export function setPendingOrderIdOnResponse(res: NextResponse, orderId: number) {
  try {
    res.cookies.set(PENDING_ORDER_COOKIE, String(orderId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      // short‑lived cookie: 15 minutes is enough for the payment flow
      maxAge: 60 * 15,
    });
  } catch {}
  return res;
}

export function clearPendingOrderIdOnResponse(res: NextResponse) {
  try {
    res.cookies.set(PENDING_ORDER_COOKIE, '', { path: '/', maxAge: 0 });
  } catch {}
  return res;
}

export function getPendingOrderIdFromRequest(req: Request): number | null {
  try {
    const cookie = req.headers.get('cookie') ?? '';
    const m = cookie.match(new RegExp(`${PENDING_ORDER_COOKIE}=([^;]+)`));
    if (!m) return null;
    const n = Number(decodeURIComponent(m[1]));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// Optional async variants (for use outside route handlers)
export async function setPendingOrderId(orderId: number) {
  try {
    const jar: any = await getCookieJar();
    jar.set({
      name: PENDING_ORDER_COOKIE,
      value: String(orderId),
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 60 * 15,
    });
  } catch {}
}

export async function getPendingOrderId(): Promise<number | null> {
  try {
    const jar: any = await getCookieJar();
    const v = jar.get(PENDING_ORDER_COOKIE)?.value;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
