import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { revalidatePath } from "next/cache";

export async function PATCH(req: Request, { params }: { params: Promise<{ slideId: string }> }) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const { slideId } = await params;
  const id = Number(slideId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, message: "Некорректный id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body?.imageUrl === "string" && body.imageUrl.trim()) data.imageUrl = body.imageUrl.trim();
  if (typeof body?.order === "number" && Number.isFinite(body.order)) data.order = Math.round(body.order);
  if (typeof body?.caption === "string") data.caption = body.caption.trim() || null;
  if (typeof body?.description === "string") data.description = body.description.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, message: "Нет изменений" }, { status: 400 });
  }

  await prisma.storySlide.update({ where: { id }, data });
  revalidatePath("/");
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slideId: string }> }) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const { slideId } = await params;
  const id = Number(slideId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, message: "Некорректный id" }, { status: 400 });
  }

  await prisma.storySlide.delete({ where: { id } });
  revalidatePath("/");
  return NextResponse.json({ success: true });
}
