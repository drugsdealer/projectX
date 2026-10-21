import { prisma } from "@/lib/prisma";
import { tbankGetState, isFinalFailStatus, describeCancelReason } from "@/lib/tbank";

/**
 * Сверка зависших заказов с банком.
 *
 * Если человек открыл форму оплаты и просто ушёл, банк сам ничего не присылает:
 * заказ навсегда остался бы «в обработке». Поэтому при открытии истории заказов
 * спрашиваем у банка статус заказов, которые ждут оплаты дольше получаса.
 *
 * Если человек всё-таки оплатит позже по той же ссылке, банк пришлёт
 * подтверждение, и заказ снова станет оплаченным — отмена не окончательная.
 */
const ABANDON_AFTER_MS = 30 * 60_000;
const MAX_CHECKS_PER_REQUEST = 5;

// Состояния, в которых человек так и не довёл оплату до конца
const NOT_STARTED = new Set(["NEW", "FORM_SHOWED"]);

type PendingRow = {
  id: number;
  status: string;
  createdAt: Date;
  paymentId?: string | null;
  cancelReason?: string | null;
  canceledAt?: Date | null;
};

export async function reconcilePendingOrders<T extends PendingRow>(rows: T[]): Promise<void> {
  const now = Date.now();
  const stale = rows
    .filter((o) => o.status === "PENDING" && now - new Date(o.createdAt).getTime() > ABANDON_AFTER_MS)
    .slice(0, MAX_CHECKS_PER_REQUEST);

  await Promise.all(
    stale.map(async (o) => {
      let reason: string | null = null;

      if (!o.paymentId) {
        reason = "Оплата не была начата";
      } else {
        const st = await tbankGetState(o.paymentId);
        if (!st.ok) return; // банк не ответил — попробуем в следующий раз
        if (isFinalFailStatus(st.status)) reason = describeCancelReason(st.status, st.message);
        else if (NOT_STARTED.has(st.status)) reason = "Оплата не была завершена";
        else return; // оплата идёт или уже прошла — ждём уведомление банка
      }

      const canceledAt = new Date();
      const res = await prisma.order
        .updateMany({
          where: { id: o.id, status: "PENDING" },
          data: { status: "CANCELED", cancelReason: reason, canceledAt },
        })
        .catch(() => null);

      if (res?.count) {
        o.status = "CANCELED";
        o.cancelReason = reason;
        o.canceledAt = canceledAt;
      }
    })
  );
}
