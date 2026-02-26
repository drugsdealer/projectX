import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json();

  const { name, description, price, category, image, brandId, categoryId } = body;

  // Basic validation/coercion (Prisma types require Category to be provided if the relation is required)
  if (!name) {
    return NextResponse.json(
      { success: false, error: "Missing product name" },
      { status: 400 }
    );
  }

  const parsedPrice = Number(price);
  if (Number.isNaN(parsedPrice)) {
    return NextResponse.json(
      { success: false, error: "Invalid price" },
      { status: 400 }
    );
  }

  // If your Prisma schema has Category as required, we MUST always send Category in `data`
  if (!categoryId && !category) {
    return NextResponse.json(
      { success: false, error: "Category is required (categoryId or category slug)" },
      { status: 400 }
    );
  }

  const connectCategory = categoryId
    ? { connect: { id: Number(categoryId) } }
    : { connect: { slug: String(category) } };

  const connectBrand = brandId ? { connect: { id: Number(brandId) } } : undefined;

  const product = await prisma.product.create({
    data: {
      name: String(name),
      description: description ?? null,
      price: parsedPrice,
      imageUrl: image ?? null,
      Brand: connectBrand,
      Category: connectCategory,
    },
  });

  return NextResponse.json({ success: true, product });
}
