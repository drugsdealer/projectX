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

  const data: {
    available?: boolean;
    premium?: boolean;
    name?: string;
    price?: number | null;
    badge?: string | null;
  } = {};

  if (typeof body?.available === "boolean") data.available = body.available;
  if (typeof body?.premium === "boolean") data.premium = body.premium;

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ success: false, message: "Название не может быть пустым" }, { status: 400 });
    }
    data.name = name;
  }

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

  if (body?.badge !== undefined) {
    if (body.badge === null || body.badge === "") {
      data.badge = null;
    } else {
      const badge = String(body.badge).trim();
      data.badge = badge ? badge.slice(0, 80) : null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, message: "Нет данных для обновления" }, { status: 400 });
  }

  const updated = await prisma.product.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      price: true,
      available: true,
      premium: true,
      badge: true,
      gender: true,
      subcategory: true,
      Category: { select: { name: true } },
      Brand: { select: { name: true } },
      Color: { select: { name: true } },
      imageUrl: true,
    },
  });

  return NextResponse.json({ success: true, product: updated });
}
