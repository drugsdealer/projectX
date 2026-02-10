import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const users = await prisma.user.findMany({
    where: {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      verified: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  return NextResponse.json({ success: true, users });
}

export async function DELETE(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;
  const admin = guard.admin;
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const idRaw = searchParams.get("id");
  const id = Number(idRaw);
  if (!idRaw || !Number.isFinite(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid id" },
      { status: 400 }
    );
  }

  if (admin.id === id) {
    return NextResponse.json(
      { success: false, message: "Нельзя удалить самого себя" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
