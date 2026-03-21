import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { slugify } from "@/lib/slug";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const brands = await prisma.brand.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      description: true,
      aboutLong: true,
      isPremium: true,
      isFeatured: true,
      _count: {
        select: {
          Product: { where: { deletedAt: null } },
        },
      },
    },
  });

  return NextResponse.json({ success: true, brands });
}

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const slug = String(body?.slug || "").trim();
  const logoUrl = String(body?.logoUrl || "").trim();
  const description = body?.description ? String(body.description).trim() : null;
  const aboutLong = body?.aboutLong ? String(body.aboutLong).trim() : null;

  if (!name) {
    return NextResponse.json({ success: false, message: "Название обязательно" }, { status: 400 });
  }

  const finalSlug = slugify(slug || name);
  if (!finalSlug) {
    return NextResponse.json({ success: false, message: "Некорректный slug" }, { status: 400 });
  }

  const existing = await prisma.brand.findFirst({
    where: { OR: [{ name }, { slug: finalSlug }] },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ success: false, message: "Бренд уже существует" }, { status: 409 });
  }

  const brand = await prisma.brand.create({
    data: {
      name,
      slug: finalSlug,
      isOfficialBrand: true,
      isPremium: false,
      logoUrl: logoUrl || null,
      description,
      aboutLong,
    },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ success: true, brand });
}

export async function PATCH(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, message: "Некорректный ID" }, { status: 400 });
  }

  const existing = await prisma.brand.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Бренд не найден" }, { status: 404 });
  }

  const data: Record<string, any> = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ success: false, message: "Название обязательно" }, { status: 400 });
    }
    data.name = name;
  }

  if (body?.slug !== undefined) {
    const slug = slugify(String(body.slug).trim());
    if (!slug) {
      return NextResponse.json({ success: false, message: "Некорректный slug" }, { status: 400 });
    }
    data.slug = slug;
  }

  if (body?.logoUrl !== undefined) {
    data.logoUrl = String(body.logoUrl).trim() || null;
  }

  if (body?.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null;
  }

  if (body?.aboutLong !== undefined) {
    data.aboutLong = body.aboutLong ? String(body.aboutLong).trim() : null;
  }

  if (body?.isPremium !== undefined) {
    data.isPremium = Boolean(body.isPremium);
  }

  if (body?.isFeatured !== undefined) {
    data.isFeatured = Boolean(body.isFeatured);
  }

  const brand = await prisma.brand.update({
    where: { id },
    data,
    select: { id: true, name: true, slug: true, logoUrl: true, description: true, aboutLong: true, isPremium: true, isFeatured: true },
  });

  return NextResponse.json({ success: true, brand });
}

export async function DELETE(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, message: "Некорректный ID" }, { status: 400 });
  }

  const existing = await prisma.brand.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Бренд не найден" }, { status: 404 });
  }
  if (existing.deletedAt) {
    return NextResponse.json({ success: false, message: "Бренд уже удалён" }, { status: 400 });
  }

  await prisma.brand.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
