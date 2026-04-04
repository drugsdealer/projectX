// app/api/promocodes/owned/route.ts
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";

export async function GET() {
  const userId = await getUserIdFromRequest();
  if (!userId) return Response.json({ promoCodes: [] });

    const promoCodes = await prisma.promoCode.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      code: true,
      description: true,
      discountType: true,
      percentOff: true,
      amountOff: true,
      appliesTo: true,
      excludedBrands: true,
      minSubtotal: true,
      maxRedemptions: true,
      startsAt: true,
      endsAt: true,
      claimedAt: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      PromoRedemption: {
        where: { userId },
        select: { usedAt: true, orderId: true },
        orderBy: { usedAt: 'asc' },
        take: 1,
      },
    },
  });

  const mapped = promoCodes.map(p => ({
    ...p,
    type: p.discountType,
    value:
      p.discountType === 'PERCENT'
        ? p.percentOff
        : p.discountType === 'AMOUNT'
        ? p.amountOff
        : null,
    usedAt: p.PromoRedemption[0]?.usedAt ?? null,
    PromoRedemption: undefined,
  }));

  return Response.json({ promoCodes: mapped });
}
