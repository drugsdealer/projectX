import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { readHomePromocodeSpace } from "@/lib/home-promocode-space";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    const [space, promoCodes] = await Promise.all([
      readHomePromocodeSpace(),
      prisma.promoCode.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          userId: null,
          maxRedemptions: null,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: [{ createdAt: "desc" }],
        take: 20,
        select: {
          code: true,
          description: true,
          discountType: true,
          percentOff: true,
          amountOff: true,
          minSubtotal: true,
          endsAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      space,
      promoCodes,
    });
  } catch (err) {
    console.error("[api.home.promocode-space]", err);
    return NextResponse.json(
      {
        success: true,
        space: await readHomePromocodeSpace(),
        promoCodes: [],
      },
      { status: 200 }
    );
  }
}
