import { prisma } from "@/lib/prisma";

export type PromoValidationInput = {
  code: string;
  userId?: number;
  subtotal?: number; // сумма корзины в рублях
};

export type PromoValidationResult = {
  ok: boolean;
  error?: string;
  code?: {
    code: string;
    description?: string | null;
    type: "percent" | "amount";
    value: number; // % или рубли
  };
  alreadyUsed?: boolean;
  remainingGlobal?: number | null; // сколько ещё использований глобально допустимо
  newTotal?: number; // если subtotal передали — вернём пересчитанную сумму
  notFound?: boolean;
  expired?: boolean;
};

export async function validatePromo(input: PromoValidationInput): Promise<PromoValidationResult> {
  const raw = (input.code || "").trim().toUpperCase();
  if (!raw) return { ok: false, error: "Введите код" };

  const now = new Date();
  const promo = await (prisma as any).promoCode.findUnique({ where: { code: raw } });
  if (!promo || !promo.isActive) return { ok: false, error: "Код не найден или неактивен", notFound: true };
  if (promo.startsAt && now < promo.startsAt) return { ok: false, error: "Код ещё не активен" };
  if (promo.endsAt && now > promo.endsAt) return { ok: false, error: "Срок действия кода истёк", expired: true };

  // Глобальные лимиты
  if (promo.maxRedemptions != null) {
    const used = await (prisma as any).promoRedemption.count({ where: { promoCodeId: promo.id } });
    if (used >= promo.maxRedemptions) {
      return { ok: false, error: "Лимит использований исчерпан" };
    }
  }

  // Проверка «уже использовал»
  let alreadyUsed = false;
  if (input.userId) {
    const dupe = await (prisma as any).promoRedemption.findFirst({
      where: { promoCodeId: promo.id, userId: input.userId },
    });
    alreadyUsed = !!dupe;
  }

  // Сумма корзины
  const subtotal = Math.max(0, Number(input.subtotal ?? 0));
  if (promo.minSubtotal && subtotal && subtotal < promo.minSubtotal) {
    return { ok: false, error: `Минимальная сумма для применения: ${promo.minSubtotal}₽` };
  }

  // Рассчёт скидки
  let type: "percent" | "amount";
  let value: number;
  if (promo.discountType === 'PERCENT' && promo.percentOff) {
    type = "percent";
    value = promo.percentOff;
  } else if (promo.discountType === 'AMOUNT' && promo.amountOff) {
    type = "amount";
    value = promo.amountOff;
  } else {
    return { ok: false, error: "Код сконфигурирован некорректно" };
  }

  let newTotal: number | undefined;
  if (subtotal) {
    const discount = type === "percent" ? Math.floor((subtotal * value) / 100) : value;
    newTotal = Math.max(0, subtotal - discount);
  }

  const remainingGlobal =
    promo.maxRedemptions == null
      ? null
      : Math.max(0, promo.maxRedemptions - (await (prisma as any).promoRedemption.count({ where: { promoCodeId: promo.id } })));

  return {
    ok: true,
    alreadyUsed,
    remainingGlobal,
    code: { code: promo.code, description: promo.description, type, value },
    newTotal,
  };
}

export async function redeemPromo(code: string, userId: number) {
  const promo = await (prisma as any).promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (!promo) throw new Error("Код не найден");

  // повторно не даём
  const dupe = await (prisma as any).promoRedemption.findFirst({ where: { promoCodeId: promo.id, userId } });
  if (dupe) return dupe;

  const redemption = await (prisma as any).promoRedemption.create({
    data: { promoCodeId: promo.id, userId },
  });

  if (promo.maxRedemptions === 1 || promo.userId) {
    await (prisma as any).promoCode.update({
      where: { id: promo.id },
      data: { isActive: false },
    });
  }

  return redemption;
}