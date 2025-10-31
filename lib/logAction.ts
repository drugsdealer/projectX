import { prisma } from "@/lib/prisma";

export async function logAction(actorId: number, table: string, action: string, data?: any) {
  try {
    const auditModel = (prisma as any).auditLog;
    if (!auditModel || typeof auditModel.create !== "function") {
      // Модель AuditLog не сконфигурирована — тихо выходим, чтобы не ломать основной поток
      return;
    }

    let payload = data || {};

    // Примитивная защита: не логируем пароль в открытом виде
    if (table === "User" && payload) {
      if (Array.isArray(payload)) {
        payload = payload.map((r) => {
          const copy: any = { ...r };
          if ("password" in copy) {
            copy.password = "[redacted]";
          }
          return copy;
        });
      } else {
        const copy: any = { ...payload };
        if ("password" in copy) {
          copy.password = "[redacted]";
        }
        payload = copy;
      }
    }

    await auditModel.create({
      data: {
        actorId,
        table,
        action: action.toUpperCase(),
        data: payload,
      },
    });
  } catch (err) {
    console.error("Ошибка записи AuditLog:", err);
  }
}