import { prisma } from "@/lib/prisma";

export type TierPricing = {
  price: number | null;
  remainingInTier: number | null;
  remainingTotal: number | null;
  hasTiers: boolean;
};

type TierRow = { productId: number; productItemId?: number | null; price: number; quantity: number; sortOrder?: number | null; id?: number };

function computeTierPricing(tiers: TierRow[], soldCount: number): TierPricing {
  if (!tiers.length) {
    return { price: null, remainingInTier: null, remainingTotal: null, hasTiers: false };
  }
  const sorted = [...tiers].sort((a, b) => {
    const ao = Number(a.sortOrder ?? 0);
    const bo = Number(b.sortOrder ?? 0);
    if (ao !== bo) return ao - bo;
    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });
  const total = sorted.reduce((sum, t) => sum + Math.max(0, Number(t.quantity || 0)), 0);
  let cumulative = 0;
  for (const t of sorted) {
    const qty = Math.max(0, Number(t.quantity || 0));
    cumulative += qty;
    if (soldCount < cumulative) {
      const remainingInTier = Math.max(0, cumulative - soldCount);
      const remainingTotal = Math.max(0, total - soldCount);
      return {
        price: Number(t.price ?? 0) || 0,
        remainingInTier,
        remainingTotal,
        hasTiers: true,
      };
    }
  }
  return { price: null, remainingInTier: 0, remainingTotal: 0, hasTiers: true };
}

export async function getTierPricingMap(productIds: number[]) {
  const out = new Map<number, TierPricing>();
  if (!productIds.length) return out;

  const client: any = prisma as any;
  if (!client?.productPriceTier?.findMany) return out;

  const tiers: TierRow[] = await client.productPriceTier.findMany({
    where: { productId: { in: productIds }, productItemId: null },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const tiersByProduct = new Map<number, TierRow[]>();
  for (const t of tiers) {
    const list = tiersByProduct.get(t.productId) ?? [];
    list.push(t);
    tiersByProduct.set(t.productId, list);
  }
  if (!tiersByProduct.size) return out;

  const soldRows: Array<{ productId: number; quantity: number }> = await client.orderItem.findMany({
    where: {
      productId: { in: productIds },
      productItemId: null,
      Order: { status: "SUCCEEDED" },
    },
    select: { productId: true, quantity: true },
  });
  const soldByProduct = new Map<number, number>();
  for (const row of soldRows) {
    const prev = soldByProduct.get(row.productId) ?? 0;
    soldByProduct.set(row.productId, prev + Number(row.quantity || 0));
  }

  for (const [productId, productTiers] of tiersByProduct.entries()) {
    const sold = soldByProduct.get(productId) ?? 0;
    out.set(productId, computeTierPricing(productTiers, sold));
  }
  return out;
}

export async function getTierPricing(productId: number) {
  const map = await getTierPricingMap([productId]);
  return map.get(productId) ?? { price: null, remainingInTier: null, remainingTotal: null, hasTiers: false };
}

export async function getTierPricingMapByProductItem(productItemIds: number[]) {
  const out = new Map<number, TierPricing>();
  if (!productItemIds.length) return out;
  const safeIds = productItemIds.filter(
    (id): id is number => typeof id === "number" && Number.isFinite(id)
  );
  if (!safeIds.length) return out;

  const client: any = prisma as any;
  if (!client?.productPriceTier?.findMany) return out;

  const tiers: TierRow[] = await client.productPriceTier.findMany({
    where: { productItemId: { in: safeIds } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const tiersByItem = new Map<number, TierRow[]>();
  for (const t of tiers) {
    const pid = Number(t.productItemId ?? NaN);
    if (!Number.isFinite(pid)) continue;
    const list = tiersByItem.get(pid) ?? [];
    list.push(t);
    tiersByItem.set(pid, list);
  }
  if (!tiersByItem.size) return out;

  const soldRows: Array<{ productItemId: number; quantity: number }> = await client.orderItem.findMany({
    where: {
      productItemId: { in: safeIds },
      Order: { status: "SUCCEEDED" },
    },
    select: { productItemId: true, quantity: true },
  });
  const soldByItem = new Map<number, number>();
  for (const row of soldRows) {
    const prev = soldByItem.get(row.productItemId) ?? 0;
    soldByItem.set(row.productItemId, prev + Number(row.quantity || 0));
  }

  for (const [productItemId, itemTiers] of tiersByItem.entries()) {
    const sold = soldByItem.get(productItemId) ?? 0;
    out.set(productItemId, computeTierPricing(itemTiers, sold));
  }
  return out;
}
