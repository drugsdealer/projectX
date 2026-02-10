import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const id = Number(params?.id);
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
