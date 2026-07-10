import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;            // после 5 неверных попыток код гасится
const TTL_MS = 10 * 60 * 1000;     // срок жизни кода — 10 минут

export type ResetCodeCheck = { ok: true } | { ok: false; message: string };

/**
 * Проверяет 6-значный код сброса пароля с защитой от брутфорса.
 * Ключевое: считает неверные попытки в БД и удаляет код после MAX_ATTEMPTS —
 * поэтому перебор невозможен независимо от IP/rate-limit.
 */
export async function verifyResetCode(userId: number, code: string): Promise<ResetCodeCheck> {
  const record = await prisma.passwordResetCode.findUnique({ where: { userId } });
  if (!record) return { ok: false, message: "Неверный код." };

  // Срок годности
  if (record.createdAt.getTime() < Date.now() - TTL_MS) {
    await prisma.passwordResetCode.delete({ where: { userId } }).catch(() => {});
    return { ok: false, message: "Срок кода истёк. Запросите новый." };
  }

  let correct = false;
  try {
    correct =
      record.code.length === code.length &&
      timingSafeEqual(Buffer.from(record.code), Buffer.from(code));
  } catch {
    correct = false;
  }

  if (!correct) {
    const attempts = (record.attempts ?? 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await prisma.passwordResetCode.delete({ where: { userId } }).catch(() => {});
      return { ok: false, message: "Слишком много неверных попыток. Запросите код заново." };
    }
    await prisma.passwordResetCode.update({ where: { userId }, data: { attempts } }).catch(() => {});
    return { ok: false, message: "Неверный код." };
  }

  return { ok: true };
}
