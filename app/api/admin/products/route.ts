import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const price = Number(body?.price ?? 0);
  const imageUrl = body?.imageUrl ? String(body.imageUrl) : "";
  const imagesInput = Array.isArray(body?.images) ? body.images : [];
  const images = imagesInput
    .map((item: any) => String(item ?? "").trim())
    .filter((item: string) => item.length > 0 && item !== imageUrl);
  const categoryId = Number(body?.categoryId);
  const brandId = body?.brandId ? Number(body.brandId) : null;
  const colorId = body?.colorId ? Number(body.colorId) : null;
  const genderRaw = typeof body?.gender === "string" ? body.gender.trim().toLowerCase() : "";
  const gender = genderRaw === "men" || genderRaw === "women" || genderRaw === "unisex" ? genderRaw : null;
  const description = body?.description ? String(body.description) : null;
  const premium = Boolean(body?.premium);
  const widthCm = Number(body?.widthCm);
  const heightCm = Number(body?.heightCm);
  const depthCm = Number(body?.depthCm);
  const sizeTypeRaw = String(body?.sizeType || "NONE").toUpperCase();
  const sizeType = sizeTypeRaw === "SHOE" || sizeTypeRaw === "CLOTH" ? sizeTypeRaw : "NONE";
  const subcategoryId = body?.subcategoryId ? Number(body.subcategoryId) : null;
  const sizeGroups = Array.isArray(body?.sizeGroups) ? body.sizeGroups : [];
  const priceTiersInput = Array.isArray(body?.priceTiers) ? body.priceTiers : [];

  const parsePrice = (val: any) => {
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.round(num);
  };
  const parseQty = (val: any) => {
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.floor(num);
  };

  const normalizedTiers = priceTiersInput
    .map((t: any, idx: number) => {
      const tierPrice = parsePrice(t?.price);
      const tierQty = parseQty(t?.quantity);
      if (!tierPrice || !tierQty) return null;
      return {
        price: tierPrice,
        quantity: tierQty,
        sortOrder: Number.isFinite(Number(t?.sortOrder)) ? Number(t.sortOrder) : idx + 1,
      };
    })
    .filter(Boolean) as Array<{ price: number; quantity: number; sortOrder: number }>;
  const firstTierPrice = normalizedTiers.length ? normalizedTiers[0].price : null;

  if (!name) {
    return NextResponse.json({ success: false, message: "Название обязательно" }, { status: 400 });
  }
  const basePrice = parsePrice(price);
  if (sizeType === "NONE" && !basePrice && !firstTierPrice) {
    return NextResponse.json({ success: false, message: "Цена должна быть больше 0" }, { status: 400 });
  }
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ success: false, message: "Категория обязательна" }, { status: 400 });
  }

  const subcategoryModel = (prisma as any).subcategory;
  const subcategory =
    subcategoryId && typeof subcategoryModel?.findUnique === "function"
      ? await subcategoryModel.findUnique({
          where: { id: subcategoryId },
          select: { id: true, slug: true, categoryId: true },
        })
      : null;
  if (subcategoryId && !subcategory) {
    return NextResponse.json({ success: false, message: "Подкатегория не найдена" }, { status: 400 });
  }
  if (subcategory && subcategory.categoryId !== categoryId) {
    return NextResponse.json(
      { success: false, message: "Подкатегория должна принадлежать выбранной категории" },
      { status: 400 }
    );
  }

  const normalizedGroups =
    sizeType === "NONE"
      ? []
      : sizeGroups
          .map((group: any) => {
            const groupPrice = parsePrice(group?.price);
            const groupTiers = Array.isArray(group?.tiers)
              ? group.tiers
                  .map((t: any, idx: number) => {
                    const price = parsePrice(t?.price);
                    const quantity = parseQty(t?.quantity);
                    if (!price || !quantity) return null;
                    return {
                      price,
                      quantity,
                      sortOrder: Number.isFinite(Number(t?.sortOrder)) ? Number(t.sortOrder) : idx + 1,
                    };
                  })
                  .filter(Boolean)
              : [];
            const sizeIds = Array.isArray(group?.sizeIds) ? group.sizeIds.map(Number).filter(Number.isFinite) : [];
            const sizeClIds = Array.isArray(group?.sizeClIds)
              ? group.sizeClIds.map(Number).filter(Number.isFinite)
              : [];
            return { price: groupPrice, sizeIds, sizeClIds, tiers: groupTiers };
          })
          .filter((group: any) => (group.price || (group.tiers && group.tiers.length)) && (group.sizeIds.length || group.sizeClIds.length));

  if (sizeType !== "NONE" && normalizedGroups.length === 0) {
    return NextResponse.json(
      { success: false, message: "Добавьте хотя бы одну группу размеров с ценой" },
      { status: 400 }
    );
  }

  const minGroupPrice =
    normalizedGroups.length > 0
      ? Math.min(
          ...normalizedGroups.map((g: any) => {
            const tierPrice = Array.isArray(g.tiers) && g.tiers.length ? Number(g.tiers[0].price) : null;
            return Number(tierPrice ?? g.price ?? 0);
          })
        )
      : null;
  const finalPrice = firstTierPrice ?? (sizeType === "NONE" ? basePrice : minGroupPrice);

  const product = await prisma.product.create({
    data: {
      name,
      price: finalPrice ?? undefined,
      imageUrl: imageUrl || "/img/placeholder.png",
      images,
      description,
      subcategory: subcategory?.slug ?? null,
      sizeType: sizeType as any,
      premium,
      widthCm: Number.isFinite(widthCm) && widthCm > 0 ? widthCm : null,
      heightCm: Number.isFinite(heightCm) && heightCm > 0 ? heightCm : null,
      depthCm: Number.isFinite(depthCm) && depthCm > 0 ? depthCm : null,
      Category: { connect: { id: categoryId } },
      ...(brandId ? { Brand: { connect: { id: brandId } } } : {}),
      ...(colorId ? { Color: { connect: { id: colorId } } } : {}),
      ...(gender ? { gender } : {}),
    },
    select: { id: true, name: true, price: true },
  });

  if (normalizedTiers.length && sizeType === "NONE") {
    const tierModel = (prisma as any).productPriceTier;
    if (typeof tierModel?.createMany === "function") {
      await tierModel.createMany({
        data: normalizedTiers.map((t) => ({
          productId: product.id,
          price: t.price,
          quantity: t.quantity,
          sortOrder: t.sortOrder,
        })),
      });
    }
  }

  if (sizeType !== "NONE" && normalizedGroups.length) {
    const sizeIds = new Set<number>();
    const sizeClIds = new Set<number>();
    const tierModel = (prisma as any).productPriceTier;

    for (const group of normalizedGroups as any[]) {
      const tierList: Array<{ price: number; quantity: number; sortOrder: number }> = Array.isArray(group.tiers)
        ? group.tiers
        : [];
      const basePrice = tierList.length ? Number(tierList[0].price) : Number(group.price);

      if (sizeType === "SHOE") {
        for (const id of group.sizeIds) {
          sizeIds.add(id);
          const item = await prisma.productItem.create({
            data: { price: basePrice, productId: product.id, sizeId: id },
            select: { id: true },
          });
          if (tierList.length && typeof tierModel?.createMany === "function") {
            await tierModel.createMany({
              data: tierList.map((t) => ({
                productId: product.id,
                productItemId: item.id,
                price: t.price,
                quantity: t.quantity,
                sortOrder: t.sortOrder,
              })),
            });
          }
        }
      }
      if (sizeType === "CLOTH") {
        for (const id of group.sizeClIds) {
          sizeClIds.add(id);
          const item = await prisma.productItem.create({
            data: { price: basePrice, productId: product.id, sizeClId: id },
            select: { id: true },
          });
          if (tierList.length && typeof tierModel?.createMany === "function") {
            await tierModel.createMany({
              data: tierList.map((t) => ({
                productId: product.id,
                productItemId: item.id,
                price: t.price,
                quantity: t.quantity,
                sortOrder: t.sortOrder,
              })),
            });
          }
        }
      }
    }

    if (sizeIds.size) {
      await prisma.product.update({
        where: { id: product.id },
        data: { Size: { connect: Array.from(sizeIds).map((id) => ({ id })) } },
      });
    }
    if (sizeClIds.size) {
      await prisma.product.update({
        where: { id: product.id },
        data: { SizeCl: { connect: Array.from(sizeClIds).map((id) => ({ id })) } },
      });
    }
  }

  return NextResponse.json({ success: true, product });
}

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("take") || 50), 1), 200);

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      price: true,
      imageUrl: true,
      premium: true,
      gender: true,
      Category: { select: { name: true } },
      Brand: { select: { name: true } },
      Color: { select: { name: true } },
    },
  });

  return NextResponse.json({ success: true, products });
}
