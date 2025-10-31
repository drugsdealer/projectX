import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "../_utils/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CART_COOKIE = "cart_token";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function resolveUserId(): Promise<number | null> {
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

  let cart = safeUserId
    ? await prisma.cart.findFirst({ where: { userId: safeUserId } })
    : null;

  if (!cart && token) {
    cart = await prisma.cart.findFirst({ where: { token } });
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

  return { cart, userId: safeUserId };
}

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const { cart, userId } = await resolveCart(jar);

  try {
    const [favoritesProducts, favoritesBrands, user, cartItems] = await Promise.all([
      userId
        ? (prisma as any).favoriteProduct.findMany({
            where: { userId },
            include: {
              Product: {
                select: { id: true, name: true, price: true, imageUrl: true, Brand: { select: { name: true } } },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([] as any[]),
      userId
        ? prisma.favoriteBrand.findMany({
            where: { userId },
            select: {
              Brand: {
                select: {
                  slug: true,
                  name: true,
                  logoUrl: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([] as any[]),
      userId
        ? prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              city: true,
              address: true,
              avatarEmoji: true,
              loyaltyPoints: true,
            },
          })
        : null,
      prisma.cartItem.findMany({
        where: { cartId: cart.id },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const cartTotal = (cartItems as any[]).reduce(
      (sum, it) => sum + Number(it.price ?? 0) * Number(it.quantity ?? 1),
      0
    );

    return NextResponse.json(
      {
        user,
        favorites: {
          products: favoritesProducts
            .filter((r: any) => r.Product)
            .map((r: any) => ({
              id: r.productId,
              name: r.Product.name,
              price: r.Product.price ?? null,
              imageUrl: r.Product.imageUrl ?? null,
              brand: r.Product.Brand?.name ?? null,
            })),
          brands: favoritesBrands.map((r: any) => r.Brand),
        },
        cart: {
          id: cart.id,
          items: cartItems,
          totalAmount: cartTotal,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    console.error("[bootstrap] error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
