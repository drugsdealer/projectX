import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const subcategoryModel = (prisma as any).subcategory;
  const hasSubcategories = typeof subcategoryModel?.findMany === "function";

  const [categories, brands, subcategories, sizes, sizeCls, colors] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    hasSubcategories
      ? subcategoryModel.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true, categoryId: true },
        })
      : Promise.resolve([]),
    prisma.size.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.sizeCl.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.color.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return NextResponse.json({
    success: true,
    categories,
    brands,
    subcategories,
    sizes,
    sizeCls,
    colors,
    subcategoriesEnabled: hasSubcategories,
  });
}
