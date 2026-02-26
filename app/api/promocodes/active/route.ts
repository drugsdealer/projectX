import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET() {
  const userId = await getUserIdFromRequest();

  if (userId && Number.isFinite(userId)) {
    const activePromo = await prisma.promoCode.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (activePromo) {
      const used = await prisma.promoRedemption.findFirst({
        where: { promoCodeId: activePromo.id, userId },
        select: { id: true },
      });
      if (used) {
        return Response.json({ promo: null });
      }
      return Response.json({
        promo: {
          code: activePromo.code,
          type: activePromo.discountType,
          value:
            activePromo.discountType === "PERCENT"
              ? activePromo.percentOff ?? 0
              : activePromo.amountOff ?? 0,
          appliesTo: activePromo.appliesTo,
          excludedBrands: activePromo.excludedBrands ?? [],
        },
      });
    }
  }

  const ck = await cookies();
  const guestCode = ck.get("promoCode")?.value || ck.get("promo_code")?.value || null;
  const guestDiscountStr = ck.get("promoDiscount")?.value || ck.get("promo_discount")?.value || null;
  const guestDiscountType =
    ck.get("promoType")?.value || ck.get("promo_type")?.value || "PERCENT";
  const guestDiscount = guestDiscountStr ? Number(guestDiscountStr) : null;

  if (guestCode && guestDiscount != null && !Number.isNaN(guestDiscount)) {
    return Response.json({
      promo: {
        code: guestCode,
        type: guestDiscountType === "AMOUNT" ? "AMOUNT" : "PERCENT",
        value: guestDiscount,
      },
    });
  }

  return Response.json({ promo: null });
}
