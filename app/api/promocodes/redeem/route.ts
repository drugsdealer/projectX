import { NextRequest, NextResponse } from "next/server";
import { redeemPromo, validatePromo } from "@/lib/promos";
import { getUserIdFromRequest } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawCode = (body?.code ?? "").toString().trim();
  if (!rawCode) {
    return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400 });
  }
  const code = rawCode.toUpperCase();

  const userId = await getUserIdFromRequest();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // Проверяем, существует ли промокод и активен ли он
  const validation = await validatePromo({ code, userId });
  if (!validation.ok) {
    if (validation.notFound) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    if (validation.expired) {
      return NextResponse.json({ ok: false, reason: "expired" }, { status: 400 });
    }
    return NextResponse.json(validation, { status: 400 });
  }
  if (validation.alreadyUsed) {
    return NextResponse.json({ ok: false, reason: "already_used" }, { status: 400 });
  }

  try {
    // Вызываем redeemPromo и деактивируем промокод
    await redeemPromo(code, userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // If userId doesn't exist in the DB we can hit a FK error (P2003)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        {
          ok: false,
          error: 'unknown_user',
          message:
            'Пользователь не найден. Передайте корректный userId (cookie `userId` или заголовок `x-user-id`).',
        },
        { status: 401 }
      );
    }

    // Fallback: explicit server error
    return NextResponse.json(
      { ok: false, error: 'server_error', details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}