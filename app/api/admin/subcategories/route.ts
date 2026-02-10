import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { slugify } from "@/lib/slug";

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const slug = String(body?.slug || "").trim();
  const categoryId = Number(body?.categoryId);

  if (!name) {
    return NextResponse.json({ success: false, message: "Название обязательно" }, { status: 400 });
  }
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ success: false, message: "Категория обязательна" }, { status: 400 });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    return NextResponse.json({ success: false, message: "Категория не найдена" }, { status: 400 });
  }

  const finalSlug = slugify(slug || name);
  if (!finalSlug) {
    return NextResponse.json({ success: false, message: "Некорректный slug" }, { status: 400 });
  }

  const existing = await prisma.subcategory.findFirst({
    where: { OR: [{ slug: finalSlug }, { name, categoryId }] },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ success: false, message: "Подкатегория уже существует" }, { status: 409 });
  }

  const subcategory = await prisma.subcategory.create({
    data: { name, slug: finalSlug, categoryId },
    select: { id: true, name: true, slug: true, categoryId: true },
  });

  return NextResponse.json({ success: true, subcategory });
}
