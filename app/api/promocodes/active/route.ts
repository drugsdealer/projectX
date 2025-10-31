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
      return Response.json({
        promo: {
          code: activePromo.code,
          discount: activePromo.percentOff ?? 0,
        },
      });
    }
  }

  const ck = await cookies();
  const guestCode = ck.get("promoCode")?.value || ck.get("promo_code")?.value || null;
  const guestDiscountStr = ck.get("promoDiscount")?.value || ck.get("promo_discount")?.value || null;
  const guestDiscount = guestDiscountStr ? Number(guestDiscountStr) : null;

  if (guestCode && guestDiscount != null && !Number.isNaN(guestDiscount)) {
    return Response.json({
      promo: {
        code: guestCode,
        discount: guestDiscount,
      },
    });
  }

  return Response.json({ promo: null });
}