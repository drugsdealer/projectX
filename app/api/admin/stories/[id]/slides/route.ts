import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { revalidatePath } from "next/cache";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const { id: idParam } = await params;
  const storyId = Number(idParam);
  if (!Number.isFinite(storyId)) {
    return NextResponse.json({ success: false, message: "Некорректный id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const imageUrl = String(body?.imageUrl || "").trim();
  if (!imageUrl) {
    return NextResponse.json({ success: false, message: "Укажите изображение слайда" }, { status: 400 });
  }
  const caption = typeof body?.caption === "string" && body.caption.trim() ? body.caption.trim() : null;
  const description =
    typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;

  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true, deletedAt: true } });
  if (!story || story.deletedAt) {
    return NextResponse.json({ success: false, message: "Сторис не найдена" }, { status: 404 });
  }

  const last = await prisma.storySlide.findFirst({
    where: { storyId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const slide = await prisma.storySlide.create({
    data: { storyId, imageUrl, caption, description, order: (last?.order ?? -1) + 1 },
  });

  revalidatePath("/");
  return NextResponse.json({ success: true, slide });
}
