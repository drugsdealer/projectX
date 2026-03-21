import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const brandId = Number(url.searchParams.get("brandId"));
  if (!Number.isFinite(brandId) || brandId <= 0) {
    return NextResponse.json(
      { success: false, message: "brandId is required" },
      { status: 400 }
    );
  }

  const products = await prisma.product.findMany({
    where: { brandId, deletedAt: null },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      price: true,
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return NextResponse.json({ success: true, products });
}

export async function DELETE(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const productId = Number(body?.productId);
  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json(
      { success: false, message: "productId is required" },
      { status: 400 }
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, brandId: true },
  });
  if (!product) {
    return NextResponse.json(
      { success: false, message: "Товар не найден" },
      { status: 404 }
    );
  }

  await prisma.product.update({
    where: { id: productId },
    data: { brandId: null },
  });

  return NextResponse.json({ success: true });
}
