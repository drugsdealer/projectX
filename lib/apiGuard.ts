import { getUserIdFromRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function requireUser(role?: string) {
  const userId = await getUserIdFromRequest();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new Error("USER_DELETED");
  if (role && user.role !== role) throw new Error("FORBIDDEN");

  return user;
}