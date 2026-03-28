import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"], // можно убрать, если не нужен лог запросов
  });

export async function getProducts() {
  return await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      price: true,
      oldPrice: true,
      imageUrl: true,
      images: true,
      description: true,
      available: true,
      premium: true,
      badge: true,
      gender: true,
      subcategory: true,
      sizeType: true,
      material: true,
      features: true,
      styleNotes: true,
      categoryId: true,
      brandId: true,
      colorId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
