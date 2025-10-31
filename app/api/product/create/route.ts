import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  const { name, description, price, category, image, brandId } = body;

  const product = await prisma.product.create({
    data: {
      name,
      description,
      price,
      category,
      imageUrl: image,
      brand: brandId ? { connect: { id: brandId } } : undefined,
    },
  });

  return NextResponse.json({ success: true, product });
}