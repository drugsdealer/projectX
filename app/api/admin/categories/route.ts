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

  if (!name) {
    return NextResponse.json({ success: false, message: "Название обязательно" }, { status: 400 });
  }

  const finalSlug = slugify(slug || name);
  if (!finalSlug) {
    return NextResponse.json({ success: false, message: "Некорректный slug" }, { status: 400 });
  }

  const existing = await prisma.category.findFirst({
    where: { OR: [{ name }, { slug: finalSlug }] },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ success: false, message: "Категория уже существует" }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: { name, slug: finalSlug },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ success: true, category });
}
