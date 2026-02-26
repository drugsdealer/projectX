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
  return await prisma.product.findMany({ where: { deletedAt: null } });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
