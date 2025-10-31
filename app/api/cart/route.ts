import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getSessionUserId } from "../_utils/session";

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
    return NextResponse.json({ success: true, cartId: cart.id, items });
  } catch (e) {
    console.error("[cart][GET] error", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const { cart } = await resolveCart(jar);
    const body = await req.json().catch(() => ({} as any));
    const items: BodyItem[] = Array.isArray(body?.items) ? body.items : [body];

    const created: any[] = [];
    for (const raw of items) {
      const data = normalizePayload(raw);
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
            productId: data.productId ?? existing.productId,
            productItemId: data.productItemId ?? existing.productItemId,
            updatedAt: new Date(),
          },
        });
        created.push(updated);
      } else {
        const row = await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            ...data,
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
    const jar = await cookies();
    const { cart } = await resolveCart(jar);
    const body = await req.json().catch(() => ({} as any));
    const id = Number(body?.id);
    const qty = Number(body?.quantity);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "id required" }, { status: 400 });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ success: false, message: "quantity must be > 0" }, { status: 400 });
    }

    await prisma.cartItem.updateMany({
      where: { id, cartId: cart.id },
      data: { quantity: qty, updatedAt: new Date() },
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
    const jar = await cookies();
    const { cart } = await resolveCart(jar);
    const body = await req.json().catch(() => ({} as any));
    const id = Number(body?.id);
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
