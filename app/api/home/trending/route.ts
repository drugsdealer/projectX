import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";

/**
 * «Сейчас смотрят» для главной: товары, которые чаще всего открывали и добавляли в корзину
 * за последние 30 дней (корзина весит втрое больше просмотра). Отдаём только id — карточки
 * главная берёт из своего каталога. Ответ кешируется на 10 минут.
 */
export const revalidate = 600;

const DAYS = 30;
const LIMIT = 24;

export async function GET() {
  try {
    const since = new Date(Date.now() - DAYS * 86_400_000);
    const rows = await withDbRetry(
      () =>
        prisma.$queryRaw<{ productId: number; score: bigint }[]>`
          SELECT e."productId", SUM(CASE WHEN e."eventType" = 'ADD_TO_CART' THEN 3 ELSE 1 END) AS score
          FROM "ShopEvent" e
          JOIN "Product" p ON p.id = e."productId"
          WHERE e."createdAt" >= ${since}
            AND e."eventType" IN ('PRODUCT_VIEW', 'ADD_TO_CART')
            AND p."deletedAt" IS NULL AND p.available = true
          GROUP BY e."productId"
          ORDER BY score DESC, e."productId" DESC
          LIMIT ${LIMIT}`,
      { retries: 1, timeoutMs: 6000, label: "home trending" }
    );
    return NextResponse.json({ ids: rows.map((r) => Number(r.productId)) });
  } catch {
    return NextResponse.json({ ids: [] });
  }
}
