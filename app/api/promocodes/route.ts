import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";

async function getUserIdFromHeadersOrCookies(): Promise<number | null> {
  try {
    const h = await headers();
    const idFromHeader = h.get("x-user-id") || h.get("X-User-Id");
    if (idFromHeader) {
      const n = Number(idFromHeader);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  try {
    const c = await cookies();
    const idFromCookie = c.get("userId")?.value || c.get("uid")?.value;
    if (idFromCookie) {
      const n = Number(idFromCookie);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromHeadersOrCookies();
    const now = new Date();

    const active = await (prisma as any).promoCode.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(userId
          ? { OR: [{ userId: null }, { userId }] }
          : { userId: null }),
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    let my: { code: string; usedAt: Date }[] = [];
    if (userId) {
      const redemptions = await (prisma as any).promoRedemption.findMany({
        where: { userId },
        include: { promoCode: true },
        orderBy: { usedAt: "desc" },
      });
      my = redemptions.map((r: any) => ({ code: r.promoCode.code, usedAt: r.usedAt }));
    }

    return NextResponse.json({ items: active, my });
  } catch (e) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
