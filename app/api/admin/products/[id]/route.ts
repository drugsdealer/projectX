import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const resolved = await params;
  const rawId = resolved?.id;
  const id = Number(rawId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, message: "Некорректный id" }, { status: 400 });
  }

  const result = await prisma.product.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), available: false },
  });

  if (result.count === 0) {
    return NextResponse.json({ success: false, message: "Товар не найден" }, { status: 404 });
  }

  return NextResponse.json({ success: true, product: { id } });
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  price: true,
  oldPrice: true,
  imageUrl: true,
  images: true,
  description: true,
  available: true,
  premium: true,
  badge: true,
  gender: true,
  subcategory: true,
  sizeType: true,
  article: true,
  material: true,
  features: true,
  styleNotes: true,
  widthCm: true,
  heightCm: true,
  depthCm: true,
  categoryId: true,
  brandId: true,
  colorId: true,
  Category: { select: { id: true, name: true } },
  Brand: { select: { id: true, name: true } },
  Color: { select: { id: true, name: true } },
} as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, message: "Некорректный id" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: PRODUCT_SELECT,
  });

  if (!product) {
    return NextResponse.json({ success: false, message: "Товар не найден" }, { status: 404 });
  }

  return NextResponse.json({ success: true, product });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const resolved = await params;
  const rawId = resolved?.id;
  const id = Number(rawId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, message: "Некорректный id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const existing = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Товар не найден" }, { status: 404 });
  }

  const data: Record<string, any> = {};

  // Boolean fields
  if (typeof body?.available === "boolean") data.available = body.available;
  if (typeof body?.premium === "boolean") data.premium = body.premium;

  // Name
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ success: false, message: "Название не может быть пустым" }, { status: 400 });
    }
    data.name = name;
  }

  // Price
  if (body?.price !== undefined) {
    if (body.price === null || body.price === "") {
      data.price = null;
    } else {
      const p = Number(body.price);
      if (!Number.isFinite(p) || p <= 0) {
        return NextResponse.json({ success: false, message: "Цена должна быть больше 0" }, { status: 400 });
      }
      data.price = p;
    }
  }

  // Old price (for discounts)
  if (body?.oldPrice !== undefined) {
    if (body.oldPrice === null || body.oldPrice === "") {
      data.oldPrice = null;
    } else {
      const op = Number(body.oldPrice);
      if (!Number.isFinite(op) || op <= 0) {
        return NextResponse.json({ success: false, message: "Старая цена должна быть больше 0" }, { status: 400 });
      }
      data.oldPrice = op;
    }
  }

  // Description
  if (body?.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null;
  }

  // Image
  if (typeof body?.imageUrl === "string") {
    data.imageUrl = body.imageUrl.trim() || null;
  }

  // Gallery images
  if (Array.isArray(body?.images)) {
    data.images = body.images
      .map((item: any) => String(item ?? "").trim())
      .filter((item: string) => item.length > 0);
  }

  // Badge
  if (body?.badge !== undefined) {
    if (body.badge === null || body.badge === "") {
      data.badge = null;
    } else {
      const badge = String(body.badge).trim();
      data.badge = badge ? badge.slice(0, 80) : null;
    }
  }

  // Gender
  if (body?.gender !== undefined) {
    const g = body.gender ? String(body.gender).trim().toLowerCase() : null;
    data.gender = g && ["men", "women", "unisex"].includes(g) ? g : null;
  }

  // Category
  if (body?.categoryId !== undefined) {
    const catId = Number(body.categoryId);
    if (!Number.isFinite(catId) || catId <= 0) {
      return NextResponse.json({ success: false, message: "Некорректная категория" }, { status: 400 });
    }
    data.categoryId = catId;
  }

  // Brand
  if (body?.brandId !== undefined) {
    if (body.brandId === null || body.brandId === "") {
      data.brandId = null;
    } else {
      const bId = Number(body.brandId);
      if (!Number.isFinite(bId) || bId <= 0) {
        return NextResponse.json({ success: false, message: "Некорректный бренд" }, { status: 400 });
      }
      data.brandId = bId;
    }
  }

  // Color
  if (body?.colorId !== undefined) {
    if (body.colorId === null || body.colorId === "") {
      data.colorId = null;
    } else {
      const cId = Number(body.colorId);
      if (!Number.isFinite(cId) || cId <= 0) {
        return NextResponse.json({ success: false, message: "Некорректный цвет" }, { status: 400 });
      }
      data.colorId = cId;
    }
  }

  // Dimensions
  if (body?.widthCm !== undefined) {
    data.widthCm = body.widthCm ? Number(body.widthCm) : null;
  }
  if (body?.heightCm !== undefined) {
    data.heightCm = body.heightCm ? Number(body.heightCm) : null;
  }
  if (body?.depthCm !== undefined) {
    data.depthCm = body.depthCm ? Number(body.depthCm) : null;
  }

  // Description attributes
  if (body?.material !== undefined) {
    data.material = body.material ? String(body.material).trim() : null;
  }
  if (body?.features !== undefined) {
    data.features = body.features ? String(body.features).trim() : null;
  }
  if (body?.styleNotes !== undefined) {
    data.styleNotes = body.styleNotes ? String(body.styleNotes).trim() : null;
  }
  if (body?.article !== undefined) {
    data.article = body.article ? String(body.article).trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, message: "Нет данных для обновления" }, { status: 400 });
  }

  const updated = await prisma.product.update({
    where: { id },
    data,
    select: PRODUCT_SELECT,
  });

  return NextResponse.json({ success: true, product: updated });
}
