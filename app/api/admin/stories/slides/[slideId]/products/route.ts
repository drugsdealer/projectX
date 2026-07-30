import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function GET(req: Request, { params }: { params: Promise<{ slideId: string }> }) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const { slideId: slideIdParam } = await params;
  const slideId = Number(slideIdParam);
  if (!Number.isFinite(slideId)) {
    return NextResponse.json({ success: false, message: "Некорректный id" }, { status: 400 });
  }

  const rows = await prisma.storySlideProduct.findMany({
    where: { storySlideId: slideId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      order: true,
      Product: {
        select: { id: true, name: true, price: true, imageUrl: true, Brand: { select: { name: true } } },
      },
    },
  });

  const products = rows.map((r) => ({
    linkId: r.id,
    order: r.order,
    id: r.Product.id,
    name: r.Product.name,
    price: r.Product.price,
    imageUrl: r.Product.imageUrl,
    brandName: r.Product.Brand?.name ?? null,
  }));

  return NextResponse.json({ success: true, products });
}

export async function POST(req: Request, { params }: { params: Promise<{ slideId: string }> }) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const { slideId: slideIdParam } = await params;
  const slideId = Number(slideIdParam);
  const body = await req.json().catch(() => ({}));
  const productId = Number(body?.productId);
  if (!Number.isFinite(slideId) || !Number.isFinite(productId)) {
    return NextResponse.json({ success: false, message: "Некорректные данные" }, { status: 400 });
  }

  const last = await prisma.storySlideProduct.findFirst({
    where: { storySlideId: slideId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  try {
    await prisma.storySlideProduct.create({
      data: { storySlideId: slideId, productId, order: (last?.order ?? -1) + 1 },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ success: false, message: "Товар уже добавлен" }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: "Не удалось привязать товар" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slideId: string }> }) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const { slideId: slideIdParam } = await params;
  const slideId = Number(slideIdParam);
  const body = await req.json().catch(() => ({}));
  const productId = Number(body?.productId);
  if (!Number.isFinite(slideId) || !Number.isFinite(productId)) {
    return NextResponse.json({ success: false, message: "Некорректные данные" }, { status: 400 });
  }

  await prisma.storySlideProduct.deleteMany({ where: { storySlideId: slideId, productId } });
  return NextResponse.json({ success: true });
}
