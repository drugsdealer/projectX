import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { cookies } from "next/headers";
import { enforceSameOrigin } from "@/lib/security";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createHmac, timingSafeEqual } from "crypto";
import { withDbRetry } from "@/lib/db-retry";

const OWNER_ADMIN_EMAIL = "eldheykrut@gmail.com";

// Ленивый геттер: проверка секрета срабатывает на рантайме (реальный запрос), а не при импорте/сборке.
function getAdmin2FASecret(): string {
  const secret =
    process.env.ADMIN_2FA_HMAC_SECRET ||
    process.env.STAGE_VAULT_SECRET ||
    (process.env.NODE_ENV !== "production" ? "dev_2fa_hmac_key" : "");
  if (!secret) {
    throw new Error("ADMIN_2FA_HMAC_SECRET or STAGE_VAULT_SECRET is required in production");
  }
  return secret;
}

export function sign2FACookie(userId: number): string {
  const payload = `2fa:${userId}:${Math.floor(Date.now() / 1000)}`;
  const sig = createHmac("sha256", getAdmin2FASecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verify2FACookie(value: string, userId: number): boolean {
  const dot = value.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const parts = payload.split(":");
  if (parts[0] !== "2fa" || parts[1] !== String(userId)) return false;
  const ts = Number(parts[2]);
  if (!Number.isFinite(ts)) return false;
  // 2FA cookie expires after 4 hours
  if (Math.floor(Date.now() / 1000) - ts > 4 * 60 * 60) return false;
  const expected = createHmac("sha256", getAdmin2FASecret()).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// Signed cookie identifying which admin is impersonating a user (prevents forging the cookie value)
export function signImpersonatorCookie(adminId: number): string {
  const payload = `imp:${adminId}:${Math.floor(Date.now() / 1000)}`;
  const sig = createHmac("sha256", getAdmin2FASecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyImpersonatorCookie(value: string): number | null {
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const parts = payload.split(":");
  if (parts[0] !== "imp") return null;
  const adminId = Number(parts[1]);
  const ts = Number(parts[2]);
  if (!Number.isFinite(adminId) || !Number.isFinite(ts)) return null;
  // Impersonation cookie expires after 24 hours (matches cookie maxAge)
  if (Math.floor(Date.now() / 1000) - ts > 24 * 60 * 60) return null;
  const expected = createHmac("sha256", getAdmin2FASecret()).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  return adminId;
}

export type AdminUser = {
  id: number;
  email: string;
  role: string;
};

function readCookieFromRequest(req: Request | undefined, name: string): string | null {
  if (!req) return null;
  const cookie = req.headers.get("cookie") || "";
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function getUserIdFromAdminRequest(req?: Request): Promise<number | null> {
  const token = readCookieFromRequest(req, "session_token");
  if (token) {
    try {
      const session = await withDbRetry(
        () => prisma.userSession.findUnique({
          where: { token },
          select: { userId: true, revokedAt: true, lastSeen: true },
        }),
        { retries: 2, baseDelayMs: 150, timeoutMs: 5000, label: "admin session lookup" }
      );
      if (!session || session.revokedAt) return null;

      const now = Date.now();
      if (!session.lastSeen || now - session.lastSeen.getTime() > 60_000) {
        prisma.userSession.update({
          where: { token },
          data: { lastSeen: new Date() },
        }).catch(() => {});
      }
      return session.userId;
    } catch {
      return null;
    }
  }

  return getUserIdFromRequest();
}

export async function getAdminUser(req?: Request): Promise<AdminUser | null> {
  const userId = await getUserIdFromAdminRequest(req);
  if (!userId) return null;
  const user = await withDbRetry(
    () => prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, deletedAt: true },
    }),
    { retries: 2, baseDelayMs: 150, timeoutMs: 5000, label: "admin user lookup" }
  ).catch(() => null);
  if (!user || user.deletedAt) return null;
  if (user.role === "ADMIN") return user;

  if (user.email.trim().toLowerCase() === OWNER_ADMIN_EMAIL) {
    const promoted = await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" as any },
      select: { id: true, email: true, role: true },
    }).catch(() => null);

    return promoted ?? { id: user.id, email: user.email, role: "ADMIN" };
  }

  return null;
}

export async function requireAdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");
  return admin;
}

export async function requireAdminApi(
  opts?: { require2FA?: boolean; req?: Request }
) {
  // CSRF check
  if (opts?.req) {
    const blocked = enforceSameOrigin(opts.req);
    if (blocked) return { ok: false, response: blocked };
  }

  // Rate limiting: 60 requests per minute per IP for admin APIs
  if (opts?.req) {
    const ip = getClientIp(opts.req);
    const rl = await rateLimit(`admin:${ip}`, 60, 60_000);
    if (!rl.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
        ),
      };
    }
  }

  const admin = await getAdminUser(opts?.req);
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  if (opts?.require2FA !== false) {
    let ok = readCookieFromRequest(opts?.req, "admin_2fa_ok");
    if (!ok) {
      const jar: any = cookies() as any;
      const c = typeof jar?.then === "function" ? await jar : jar;
      ok = c.get("admin_2fa_ok")?.value;
    }
    if (!ok || !verify2FACookie(ok, admin.id)) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "2FA required" },
          { status: 403 }
        ),
      };
    }
  }
  return { ok: true, admin };
}
