import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest();
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
      select: {
        code: true,
        description: true,
        discountType: true,
        percentOff: true,
        amountOff: true,
        endsAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let my: { code: string; usedAt: Date }[] = [];
    if (userId) {
      const redemptions = await (prisma as any).promoRedemption.findMany({
        where: { userId },
        include: { PromoCode: true },
        orderBy: { usedAt: "desc" },
      });
      my = redemptions.map((r: any) => ({ code: r.PromoCode.code, usedAt: r.usedAt }));
    }

    return NextResponse.json({ items: active, my });
  } catch (e) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
