import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

const cleanCode = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const isValidCode = (code: string) => /^[A-Z0-9_-]{3,24}$/.test(code);

const toIntOrNull = (v: any) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

const toDateOrNull = (v: any) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const promoCodes = await prisma.promoCode.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { PromoRedemption: true } } },
  });

  const mapped = promoCodes.map((p) => ({
    id: p.id,
    code: p.code,
    description: p.description,
    discountType: p.discountType,
    percentOff: p.percentOff,
    amountOff: p.amountOff,
    appliesTo: p.appliesTo,
    excludedBrands: p.excludedBrands,
    minSubtotal: p.minSubtotal,
    maxRedemptions: p.maxRedemptions,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    isActive: p.isActive,
    createdAt: p.createdAt,
    usedCount: p._count?.PromoRedemption ?? 0,
  }));

  return NextResponse.json({ success: true, promoCodes: mapped });
}

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const code = cleanCode(String(body?.code || ""));
  if (!code || !isValidCode(code)) {
    return NextResponse.json(
      { success: false, message: "Код должен быть 3–24 символа (A-Z, 0-9, -, _)" },
      { status: 400 }
    );
  }

  const discountType = String(body?.discountType || "PERCENT").toUpperCase() === "AMOUNT" ? "AMOUNT" : "PERCENT";
  const percentOff = toIntOrNull(body?.percentOff);
  const amountOff = toIntOrNull(body?.amountOff);
  const appliesToRaw = String(body?.appliesTo || "ALL").toUpperCase();
  const appliesTo =
    appliesToRaw === "PREMIUM_ONLY" || appliesToRaw === "NON_PREMIUM_ONLY" ? appliesToRaw : "ALL";
  const excludedBrandsInput = Array.isArray(body?.excludedBrands)
    ? body.excludedBrands
    : String(body?.excludedBrands || "")
        .split(",")
        .map((v: string) => v.trim())
        .filter(Boolean);
  const excludedBrands = excludedBrandsInput
    .map((v: any) => String(v).trim().toLowerCase())
    .filter(Boolean);
  const minSubtotal = toIntOrNull(body?.minSubtotal);
  const maxRedemptions = toIntOrNull(body?.maxRedemptions);
  const startsAt = toDateOrNull(body?.startsAt);
  const endsAt = toDateOrNull(body?.endsAt);
  const description = body?.description ? String(body.description).trim() : null;
  const isActive = body?.isActive !== false;

  if (discountType === "PERCENT") {
    if (!percentOff || percentOff <= 0 || percentOff > 95) {
      return NextResponse.json(
        { success: false, message: "Процент скидки должен быть от 1 до 95" },
        { status: 400 }
      );
    }
  } else {
    if (!amountOff || amountOff <= 0) {
      return NextResponse.json(
        { success: false, message: "Сумма скидки должна быть больше 0" },
        { status: 400 }
      );
    }
  }

  if (minSubtotal != null && minSubtotal < 0) {
    return NextResponse.json({ success: false, message: "Минимальная сумма некорректна" }, { status: 400 });
  }
  if (maxRedemptions != null && maxRedemptions <= 0) {
    return NextResponse.json({ success: false, message: "Лимит использований некорректен" }, { status: 400 });
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    return NextResponse.json({ success: false, message: "Дата окончания раньше даты начала" }, { status: 400 });
  }

  try {
    const promo = await prisma.promoCode.create({
      data: {
        code,
        description,
        discountType,
        percentOff: discountType === "PERCENT" ? percentOff : null,
        amountOff: discountType === "AMOUNT" ? amountOff : null,
        appliesTo,
        excludedBrands,
        minSubtotal,
        maxRedemptions,
        startsAt,
        endsAt,
        isActive,
      },
    });
    return NextResponse.json({ success: true, promo });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ success: false, message: "Такой код уже существует" }, { status: 409 });
    }
    console.error("[admin.promocodes] create failed", e);
    return NextResponse.json({ success: false, message: "Ошибка создания" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, message: "Некорректный id" }, { status: 400 });
  }

  if (body?.delete) {
    await prisma.promoCode.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (body?.isActive !== undefined) {
    const isActive = Boolean(body.isActive);
    await prisma.promoCode.update({ where: { id }, data: { isActive } });
    return NextResponse.json({ success: true });
  }

  if (body?.appliesTo || body?.excludedBrands) {
    const appliesToRaw = String(body?.appliesTo || "ALL").toUpperCase();
    const appliesTo =
      appliesToRaw === "PREMIUM_ONLY" || appliesToRaw === "NON_PREMIUM_ONLY" ? appliesToRaw : "ALL";
    const excludedBrandsInput = Array.isArray(body?.excludedBrands)
      ? body.excludedBrands
      : String(body?.excludedBrands || "")
          .split(",")
          .map((v: string) => v.trim())
          .filter(Boolean);
    const excludedBrands = excludedBrandsInput
      .map((v: any) => String(v).trim().toLowerCase())
      .filter(Boolean);
    await prisma.promoCode.update({ where: { id }, data: { appliesTo, excludedBrands } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, message: "Нет изменений" }, { status: 400 });
}
