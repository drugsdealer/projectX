import { prisma } from "@/lib/prisma";
import { headers, cookies } from "next/headers";

type PromoRedemptionView = { code: string; usedAt: Date };

// Fallback helpers for runtime when Prisma is not generated for new models
async function fetchActivePromos(now: Date) {
  const client: any = prisma as any;
  if (client?.promoCode?.findMany) {
    return client.promoCode.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  }
  // Fallback raw SQL (safe parameterization via tagged template)
  const rows = await prisma.$queryRaw<any[]>`
    SELECT *
    FROM "PromoCode"
    WHERE "isActive" = true
      AND ("startsAt" IS NULL OR "startsAt" <= ${now})
      AND ("endsAt"   IS NULL OR "endsAt"   >= ${now})
    ORDER BY "createdAt" DESC
  `;
  return rows;
}

async function fetchUserRedemptions(userId: number): Promise<PromoRedemptionView[]> {
  const client: any = prisma as any;
  if (client?.promoRedemption?.findMany) {
    const redemptions = await client.promoRedemption.findMany({
      where: { userId },
      include: { promoCode: true },
      orderBy: { usedAt: "desc" },
    });
    return redemptions.map(
      (r: any): PromoRedemptionView => ({
        code: String(r.promoCode?.code ?? ""),
        usedAt: r.usedAt as Date,
      })
    );
  }
  // Fallback raw SQL join
  const rows = await prisma.$queryRaw<any[]>`
    SELECT p."code" as code, r."usedAt" as "usedAt"
    FROM "PromoRedemption" r
    JOIN "PromoCode" p ON p."id" = r."promoCodeId"
    WHERE r."userId" = ${userId}
    ORDER BY r."usedAt" DESC
  `;
  // Ensure usedAt is a Date
  return rows.map(
    (r: any): PromoRedemptionView => ({
      code: String(r.code),
      usedAt: new Date(r.usedAt),
    })
  );
}

async function getUserFromHeaders() {
  try {
    const h = await headers();
    const c = await cookies();
    const idFromHeader = h.get("x-user-id") || h.get("X-User-Id");
    const idFromCookie = c.get("userId")?.value || c.get("uid")?.value;
    const idStr = idFromHeader ?? idFromCookie ?? undefined;
    const id = idStr ? Number(idStr) : undefined;
    if (id && Number.isFinite(id)) {
      return { id, name: undefined as string | undefined };
    }
  } catch {}
  return null;
}

export const dynamic = "force-dynamic";

export default async function PromoCodesPage() {
  const user = await getUserFromHeaders(); // верни { id, name? } или null
  const now = new Date();

  const active = await fetchActivePromos(now);

  let my: { code: string; usedAt: string }[] = [];
  if (user?.id) {
    const rows = await fetchUserRedemptions(user.id);
    my = rows.map((r) => ({ code: r.code, usedAt: r.usedAt.toISOString() }));
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Промокоды</h1>
      <p className="text-gray-500 mt-1">Активируйте промокод или посмотрите уже использованные.</p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Доступные промо */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-bold">Доступные промо</div>
                {user?.id ? (
                  <div className="text-xs text-gray-500">
                    Пользователь ID: <span className="font-semibold">{user.id}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {active.length === 0 ? (
              <div className="text-sm text-gray-500">Пока нет активных промокодов.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {active.map((p: any) => {
                  const label =
                    p.discountType === "PERCENT" && p.percentOff != null
                      ? `−${p.percentOff}%`
                      : p.discountType === "AMOUNT" && p.amountOff != null
                      ? `−${p.amountOff}₽`
                      : "Промо";
                  return (
                    <div key={p.id} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-extrabold">{label}</div>
                        <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-black text-white">
                          {p.code}
                        </span>
                      </div>
                      {p.description && <div className="text-sm text-gray-600 mt-2">{p.description}</div>}
                      {p.minSubtotal ? (
                        <div className="text-xs text-gray-400 mt-1">от {p.minSubtotal}₽</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Мои использованные */}
        <div>
          <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5 shadow-sm">
            <div className="text-lg font-bold mb-3">Использованные</div>
            {my.length === 0 ? (
              <div className="text-sm text-gray-500">Здесь появятся использованные промокоды.</div>
            ) : (
              <ul className="space-y-2">
                {my.map((m, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{m.code}</span>
                    <span className="text-gray-500">{new Date(m.usedAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-400">
        Валидация и применение кода в корзине добавим после подключения клиентского компонента.
      </div>
    </div>
  );
}
