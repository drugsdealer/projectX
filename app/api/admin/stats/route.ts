import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const [usersCount, ordersCount, paidAgg] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.order.count(),
    prisma.order.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalRevenue = Number(paidAgg._sum.totalAmount || 0);

  return NextResponse.json({
    success: true,
    stats: {
      usersCount,
      ordersCount,
      totalRevenue,
    },
  });
}
