import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_TOKEN_COOKIE = "session_token";

/**
 * Проверяет, существует ли пользователь и не soft-deleted ли он.
 */
async function validateUserExists(userId: number | null) {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });

    // Если пользователя нет или он деактивирован — очищаем куки
    const maybe = cookies() as any;
    const jar = typeof maybe?.then === "function" ? await maybe : maybe;

    if (!user || user.deletedAt) {
      jar.delete?.("userId");
      jar.delete?.("session_user_id");
      jar.delete?.("auth_user_id");
      console.warn(`⚠️ Сессия недействительна, userId=${userId} удалён или деактивирован`);
      return null;
    }
    return user.id;
  } catch (e) {
    console.error("Ошибка проверки пользователя:", e);
    // Если БД недоступна, не блокируем навигацию в dev
    if (process.env.NODE_ENV !== "production") return userId;
    return null;
  }
}

/**
 * Получить next-auth сессию (если используется next-auth).
 */
export async function getAuthSession() {
  return await getServerSession(authOptions as any);
}

/**
 * Аккуратно парсим возможный JSON/номер в строке.
 */
function parseIdLike(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  try {
    const str = String(raw).trim();
    if (!str) return null;
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Достаём guest token из кук/заголовков.
 */
export async function getGuestToken(): Promise<string | undefined> {
  // cookies() может вернуть промис в ряде сред — нормализуем.
  const maybe = cookies() as any;
  const jar = typeof maybe?.then === "function" ? await maybe : maybe;

  // приоритетные имена куки
  const cookieNames = [
    "guest_order_token",
    "order_token",
    "guestToken",
    "orderToken",
    "token",
  ];

  for (const name of cookieNames) {
    const val = jar?.get?.(name)?.value;
    if (val) return val;
  }

  // попробуем заголовки
  const maybeH = headers() as any;
  const h = typeof maybeH?.then === "function" ? await maybeH : maybeH;
  const hdrKeys = ["x-guest-token", "x-order-token", "x-token"];
  for (const key of hdrKeys) {
    const v = h.get(key);
    if (v) return v;
  }

  // Authorization: Bearer <token>
  const auth = h.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return undefined;
}

/**
 * Универсально достаёт числовой userId из:
 * 1) next-auth (если подключён)
 * 2) httpOnly-кук (несколько популярных имён + JSON в одной куке)
 * 3) заголовков (на случай SSR-прокси/дебага)
 */
export async function getUserIdFromRequest(): Promise<number | null> {
  const isProd = process.env.NODE_ENV === "production";
  let foundUserId: number | null = null;

  // 0) session token (DB-backed)
  try {
    const maybe = cookies() as any;
    const jar = typeof maybe?.then === "function" ? await maybe : maybe;
    const sessionToken = jar?.get?.(SESSION_TOKEN_COOKIE)?.value;
    if (sessionToken) {
      try {
        const session = await prisma.userSession.findUnique({
          where: { token: sessionToken },
          select: { userId: true, revokedAt: true, lastSeen: true },
        });
        if (!session || session.revokedAt) {
          // do not clear session_user_id here; fall back to legacy cookie
          jar.delete?.(SESSION_TOKEN_COOKIE);
          // fall through to other mechanisms
        } else {
          const now = Date.now();
          if (!session.lastSeen || now - session.lastSeen.getTime() > 5 * 60 * 1000) {
            prisma.userSession.update({
              where: { token: sessionToken },
              data: { lastSeen: new Date() },
            }).catch(() => {});
          }
          foundUserId = session.userId;
        }
      } catch {
        // БД недоступна — игнорируем session_token и продолжаем
      }
    }
  } catch {}

  // 1) next-auth
  try {
    const session = await getServerSession(authOptions as any);
    // подстраховка на случай иной структуры user
    // @ts-ignore
    const sid = session?.user?.id ?? session?.id;
    if (sid !== undefined && sid !== null) {
      const n = Number(sid);
      if (Number.isFinite(n)) {
        foundUserId = n;
      }
    }
  } catch {}

  // 2) кастомные httpOnly-куки
  if (foundUserId === null) {
    try {
      const maybe = cookies() as any;
      const jar = typeof maybe?.then === "function" ? await maybe : maybe;

      // возможные варианты названий:
      // в production максимально ограничиваемся проверенными httpOnly-куками,
      // в dev допускаем дополнительные варианты для отладки.
      const candidates = isProd
        ? ["session_user_id", "auth_user_id"]
        : [
            "session_user_id",
            "sessionUserId",
            "userId",
            "user_id",
            "uid",
            "auth_user_id",
            "auth_user",
            "session",
          ];

      for (const name of candidates) {
        const val = jar?.get?.(name)?.value;
        const n = parseIdLike(val);
        if (n !== null) {
          foundUserId = n;
          break;
        }
      }
    } catch {}
  }

  // 3) заголовки (для SSR/прокси/дебага) — только вне production
  if (!isProd && foundUserId === null) {
    try {
      const maybeH = headers() as any;
      const h = typeof maybeH?.then === "function" ? await maybeH : maybeH;
      const hdrCandidates = ["x-user-id", "x-uid", "x-user"];
      for (const key of hdrCandidates) {
        const n = parseIdLike(h.get(key));
        if (n !== null) {
          foundUserId = n;
          break;
        }
      }
    } catch {}
  }

  const validated = await validateUserExists(foundUserId);
  return validated;
}

/**
 * Удобный комбайн: кто смотрит (юзер/гость).
 */
export async function getViewerIdentity() {
  const userId = await getUserIdFromRequest();
  const guestToken = await getGuestToken();
  return { userId, guestToken };
}
