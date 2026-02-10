import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { cookies } from "next/headers";
import { enforceSameOrigin } from "@/lib/security";

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
  if (opts?.req) {
    const blocked = enforceSameOrigin(opts.req);
    if (blocked) return { ok: false, response: blocked };
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
    if (!ok || ok !== String(admin.id)) {
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
