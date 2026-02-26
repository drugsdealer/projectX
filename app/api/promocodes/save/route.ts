// app/api/promocodes/save/route.ts
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawCode = (body?.code ?? "").toString().trim();
  if (!rawCode) {
    return Response.json({ ok: false, error: "invalid_code" }, { status: 400 });
  }
  const code = rawCode.toUpperCase();
  const userId = await getUserIdFromRequest();
  if (!userId) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) return Response.json({ ok: false, error: "not_found" });

  // Базовые проверки перед сохранением пользователю
  const now = new Date();

  // Если промокод уже привязан к другому пользователю — запрещаем
  if (promo.userId && promo.userId !== userId) {
    return Response.json({ ok: false, error: "already_claimed" }, { status: 409 });
  }

  // Если промокод уже сохранён за этим пользователем — делаем операцию идемпотентной
  if (promo.userId === userId) {
    return Response.json({ ok: true, alreadyOwned: true });
  }

  // Проверяем сроки действия (если заданы в схеме)
  if (promo.startsAt && promo.startsAt > now) {
    return Response.json({ ok: false, error: "not_started" }, { status: 400 });
  }
  if (promo.endsAt && promo.endsAt < now) {
    return Response.json({ ok: false, error: "expired" }, { status: 400 });
  }

  const userExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!userExists) {
    return Response.json({ ok: false, error: "user_not_found" }, { status: 400 });
  }

  try {
    // Пытаемся атомарно привязать промокод к пользователю только если он ещё никому не принадлежит
    const result = await prisma.promoCode.updateMany({
      where: { id: promo.id, userId: null },
      data: { userId, claimedAt: now },
    });

    if (result.count === 0) {
      // Кто‑то успел забрать промокод раньше
      return Response.json({ ok: false, error: "already_claimed" }, { status: 409 });
    }
  } catch (e: any) {
    if (e.code === "P2003") {
      return Response.json({ ok: false, error: "user_not_found" }, { status: 400 });
    }
    console.error("Ошибка при сохранении промокода:", e);
    return Response.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  return Response.json({ ok: true });
}