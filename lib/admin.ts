import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { cookies } from "next/headers";
import { enforceSameOrigin } from "@/lib/security";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createHmac, timingSafeEqual } from "crypto";

const ADMIN_2FA_SECRET =
  process.env.ADMIN_2FA_HMAC_SECRET ||
  process.env.STAGE_VAULT_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev_2fa_hmac_key" : "");

export function sign2FACookie(userId: number): string {
  const payload = `2fa:${userId}:${Math.floor(Date.now() / 1000)}`;
  const sig = createHmac("sha256", ADMIN_2FA_SECRET).update(payload).digest("hex");
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
  const expected = createHmac("sha256", ADMIN_2FA_SECRET).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export type AdminUser = {
  id: number;
  email: string;
  role: string;
};

export async function getAdminUser(): Promise<AdminUser | null> {
  const userId = await getUserIdFromRequest();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user || user.role !== "ADMIN") return null;
  return user;
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

  const admin = await getAdminUser();
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
    const jar: any = cookies() as any;
    const c = typeof jar?.then === "function" ? await jar : jar;
    const ok = c.get("admin_2fa_ok")?.value;
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
