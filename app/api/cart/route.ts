import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getSessionUserId } from "../_utils/session";
import { enforceSameOrigin } from "@/lib/security";
import { getTierPricingMap, getTierPricingMapByProductItem } from "@/lib/price-tiers";

export const runtime = "nodejs";

const CART_COOKIE = "cart_token";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type BodyItem = {
  id?: number; // cartItem id for updates/deletes
  productId?: number | null;
  productItemId?: number | null;
  name?: string;
  price?: number;
  image?: string | null;
  size?: string | number | null;
  quantity?: number;
  postponed?: boolean;
};

async function resolveUserId() {
  const raw = await getSessionUserId().catch(() => null);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function resolveCart(jar: any) {
  const userId = await resolveUserId();
  const userExists = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    : null;
  const safeUserId = userExists ? userId : null;
  let token = jar.get(CART_COOKIE)?.value ?? null;

  if (!token) {
    token = crypto.randomUUID();
    jar.set({
      name: CART_COOKIE,
      value: token,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CART_COOKIE_MAX_AGE,
    });
  }

  // Try find by userId first, then by token
  let cart = safeUserId
    ? await prisma.cart.findFirst({ where: { userId: safeUserId } })
    : null;

  if (!cart && token) {
    cart = await prisma.cart.findFirst({ where: { token } });
    // attach user if logged in
    if (cart && safeUserId && !cart.userId) {
      cart = await prisma.cart.update({
        where: { id: cart.id },
        data: { userId: safeUserId },
      });
    }
  }

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        userId: safeUserId,
        token,
        updatedAt: new Date(),
      },
    });
  }

  return { cart, token, userId: safeUserId };
}

function normalizePayload(it: BodyItem) {
  return {
    productId: it.productId ?? null,
    productItemId: it.productItemId ?? null,
    name: it.name?.toString() ?? "",
    price: Number(it.price ?? 0),
    image: it.image ?? null,
    sizeLabel: it.size != null ? String(it.size) : null,
    quantity: Math.max(1, Number(it.quantity ?? 1)),
    postponed: typeof it.postponed === "boolean" ? it.postponed : undefined,
  };
}

export async function GET() {
  try {
    const jar = await cookies();
    const { cart } = await resolveCart(jar);
    const items = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: "asc" },
      include: {
        ProductItem: true,
      },
    });
    const productIds = Array.from(
      new Set(
        items
          .map((it: any) => it.productId ?? it.ProductItem?.productId)
          .filter((id: any) => Number.isFinite(Number(id)))
          .map((id: any) => Number(id))
      )
    );
    const productItemIds = Array.from(
      new Set(
        items
          .map((it: any) => it.productItemId ?? it.ProductItem?.id)
          .filter((id: any) => Number.isFinite(Number(id)))
          .map((id: any) => Number(id))
      )
    );
    const tierMap = productIds.length ? await getTierPricingMap(productIds) : new Map();
    const itemTierMap = productItemIds.length ? await getTierPricingMapByProductItem(productItemIds) : new Map();

    const itemsOut = items.map((it: any) => {
      const resolvedProductId = it.productId ?? it.ProductItem?.productId ?? null;
      const itemId = Number(it?.productItemId ?? it?.ProductItem?.id ?? NaN);
      const itemTier = Number.isFinite(itemId) ? itemTierMap.get(itemId) : null;
      const prodTier = Number.isFinite(Number(resolvedProductId)) ? tierMap.get(Number(resolvedProductId)) : null;
      const tier = itemTier?.hasTiers ? itemTier : prodTier;
      const dynamicPrice = tier?.hasTiers ? tier.price : null;
      const dynamicStock = tier?.hasTiers ? tier.remainingInTier : null;
      return {
        ...it,
        productId: resolvedProductId ?? it.productId,
        price: tier?.hasTiers ? dynamicPrice : it.price,
        stock: dynamicStock != null ? dynamicStock : (typeof it?.stock === "number" ? it.stock : null),
        pricing: tier?.hasTiers
          ? {
              price: dynamicPrice,
              remaining: dynamicStock,
              remainingTotal: tier?.remainingTotal ?? null,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, cartId: cart.id, items: itemsOut });
  } catch (e) {
    console.error("[cart][GET] error", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const blocked = enforceSameOrigin(req);
    if (blocked) return blocked;
    const jar = await cookies();
    const { cart } = await resolveCart(jar);
    const body = await req.json().catch(() => ({} as any));
    const items: BodyItem[] = Array.isArray(body?.items) ? body.items : [body];

    const created: any[] = [];
    for (const raw of items) {
      const data = normalizePayload(raw);
      let resolvedProductId = data.productId ?? null;
      if (!resolvedProductId && data.productItemId) {
        const pi = await prisma.productItem.findUnique({
          where: { id: data.productItemId },
          select: { productId: true },
        });
        resolvedProductId = pi?.productId ?? null;
      }
      if (resolvedProductId && data.postponed !== true) {
        const itemId = data.productItemId ? Number(data.productItemId) : null;
        const itemTierMap = itemId ? await getTierPricingMapByProductItem([itemId]) : new Map();
        const itemTier = itemId ? itemTierMap.get(itemId) : null;
        const prodTierMap = await getTierPricingMap([resolvedProductId]);
        const prodTier = prodTierMap.get(resolvedProductId);
        const tier = itemTier?.hasTiers ? itemTier : prodTier;
        const remaining = Number(tier?.remainingInTier ?? NaN);
        const tierPrice = Number(tier?.price ?? NaN);
        if (tier?.hasTiers) {
          if (!Number.isFinite(remaining) || remaining <= 0 || !Number.isFinite(tierPrice) || tierPrice <= 0) {
            return NextResponse.json(
              { success: false, message: "Товар закончился" },
              { status: 400 }
            );
          }
          const currentRows = await prisma.cartItem.findMany({
            where: {
              cartId: cart.id,
              ...(itemId ? { productItemId: itemId } : { productId: resolvedProductId }),
              postponed: false,
            },
            select: { quantity: true },
          });
          const currentQty = currentRows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
          if (currentQty + data.quantity > remaining) {
            return NextResponse.json(
              { success: false, message: `Доступно только ${remaining} шт.` },
              { status: 400 }
            );
          }
        }
      }
      // try merge existing by productId + sizeLabel or productItemId
      const orConditions: any[] = [];
      if (data.productItemId != null) {
        orConditions.push({ productItemId: data.productItemId });
      }
      orConditions.push({
        productItemId: null,
        productId: data.productId ?? undefined,
        sizeLabel: data.sizeLabel ?? undefined,
      });

      const existing = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          OR: orConditions,
        },
      });

      if (existing) {
        const updated = await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: (existing.quantity ?? 1) + data.quantity,
            name: data.name || existing.name,
            price: data.price || existing.price,
            image: data.image ?? existing.image,
            sizeLabel: data.sizeLabel ?? existing.sizeLabel,
            productId: resolvedProductId ?? data.productId ?? existing.productId,
            productItemId: data.productItemId ?? existing.productItemId,
            ...(typeof data.postponed === "boolean" ? { postponed: data.postponed } : {}),
            updatedAt: new Date(),
          },
        });
        created.push(updated);
      } else {
        const row = await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            ...data,
            productId: resolvedProductId ?? data.productId ?? undefined,
            ...(typeof data.postponed === "boolean" ? { postponed: data.postponed } : {}),
            updatedAt: new Date(),
          },
        });
        created.push(row);
      }
    }

    const itemsOut = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    return NextResponse.json({ success: true, items: itemsOut });
  } catch (e) {
    console.error("[cart][POST] error", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const blocked = enforceSameOrigin(req);
    if (blocked) return blocked;
    const jar = await cookies();
    const { cart } = await resolveCart(jar);
    const body = await req.json().catch(() => ({} as any));
    const id = Number(body?.id);
    const qty = Number(body?.quantity);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "id required" }, { status: 400 });
    }
    const hasQty = Number.isFinite(qty) && qty > 0;
    const hasPostponed = typeof body?.postponed === "boolean";
    if (!hasQty && !hasPostponed) {
      return NextResponse.json({ success: false, message: "quantity or postponed required" }, { status: 400 });
    }

    const current = await prisma.cartItem.findFirst({
      where: { id, cartId: cart.id },
      select: { id: true, productId: true, productItemId: true, postponed: true, quantity: true },
    });
    if (!current) {
      return NextResponse.json({ success: false, message: "Товар не найден" }, { status: 404 });
    }
    let resolvedProductId = current.productId ?? null;
    if (!resolvedProductId && current.productItemId) {
      const pi = await prisma.productItem.findUnique({
        where: { id: current.productItemId },
        select: { productId: true },
      });
      resolvedProductId = pi?.productId ?? null;
    }
    const nextQty = hasQty ? qty : Number(current.quantity ?? 1);
    const nextPostponed = hasPostponed ? body.postponed : current.postponed;

    if (resolvedProductId && nextPostponed !== true) {
      const itemId = current.productItemId ? Number(current.productItemId) : null;
      const itemTierMap = itemId ? await getTierPricingMapByProductItem([itemId]) : new Map();
      const itemTier = itemId ? itemTierMap.get(itemId) : null;
      const prodTierMap = await getTierPricingMap([resolvedProductId]);
      const prodTier = prodTierMap.get(resolvedProductId);
      const tier = itemTier?.hasTiers ? itemTier : prodTier;
      const remaining = Number(tier?.remainingInTier ?? NaN);
      const tierPrice = Number(tier?.price ?? NaN);
      if (tier?.hasTiers) {
        if (!Number.isFinite(remaining) || remaining <= 0 || !Number.isFinite(tierPrice) || tierPrice <= 0) {
          return NextResponse.json(
            { success: false, message: "Товар закончился" },
            { status: 400 }
          );
        }
        const otherRows = await prisma.cartItem.findMany({
          where: {
            cartId: cart.id,
            ...(itemId ? { productItemId: itemId } : { productId: resolvedProductId }),
            postponed: false,
            id: { not: id },
          },
          select: { quantity: true },
        });
        const otherQty = otherRows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
        if (otherQty + nextQty > remaining) {
          return NextResponse.json(
            { success: false, message: `Доступно только ${remaining} шт.` },
            { status: 400 }
          );
        }
      }
    }

    await prisma.cartItem.updateMany({
      where: { id, cartId: cart.id },
      data: {
        ...(hasQty ? { quantity: qty } : {}),
        ...(hasPostponed ? { postponed: body.postponed } : {}),
        ...(resolvedProductId ? { productId: resolvedProductId } : {}),
        updatedAt: new Date(),
      },
    });

    const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    return NextResponse.json({ success: true, items });
  } catch (e) {
    console.error("[cart][PATCH] error", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const blocked = enforceSameOrigin(req);
    if (blocked) return blocked;
    const jar = await cookies();
    const { cart } = await resolveCart(jar);
    const body = await req.json().catch(() => ({} as any));
    const idsRaw = Array.isArray(body?.ids) ? body.ids : null;
    const ids = idsRaw ? idsRaw.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0) : [];
    const id = Number(body?.id);
    if (ids.length > 0) {
      await prisma.cartItem.deleteMany({ where: { id: { in: ids }, cartId: cart.id } });
      const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
      return NextResponse.json({ success: true, items });
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "id required" }, { status: 400 });
    }
    await prisma.cartItem.deleteMany({ where: { id, cartId: cart.id } });
    const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    return NextResponse.json({ success: true, items });
  } catch (e) {
    console.error("[cart][DELETE] error", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
