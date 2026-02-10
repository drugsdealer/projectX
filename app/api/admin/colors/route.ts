import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();

  if (!name) {
    return NextResponse.json({ success: false, message: "Название обязательно" }, { status: 400 });
  }

  const existing = await prisma.color.findFirst({
    where: { name },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ success: false, message: "Цвет уже существует" }, { status: 409 });
  }

  const color = await prisma.color.create({
    data: { name },
    select: { id: true, name: true },
  });

  return NextResponse.json({ success: true, color });
}
