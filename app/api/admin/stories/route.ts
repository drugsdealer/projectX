import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const stories = await prisma.story.findMany({
    where: { deletedAt: null },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      order: true,
      isActive: true,
      createdAt: true,
      Slides: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          imageUrl: true,
          caption: true,
          description: true,
          order: true,
          _count: { select: { Products: true } },
        },
      },
    },
  });

  const mapped = stories.map((s) => ({
    id: s.id,
    title: s.title,
    order: s.order,
    isActive: s.isActive,
    createdAt: s.createdAt,
    slides: s.Slides.map((sl) => ({
      id: sl.id,
      imageUrl: sl.imageUrl,
      caption: sl.caption,
      description: sl.description,
      order: sl.order,
      productCount: sl._count.Products,
    })),
  }));

  return NextResponse.json({ success: true, stories: mapped });
}

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  if (!title) {
    return NextResponse.json({ success: false, message: "Укажите название сторис" }, { status: 400 });
  }

  const last = await prisma.story.findFirst({
    where: { deletedAt: null },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const story = await prisma.story.create({
    data: { title, order: (last?.order ?? -1) + 1 },
  });

  return NextResponse.json({ success: true, story });
}
