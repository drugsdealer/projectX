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

  const parsePrice = (val: any) => {
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.round(num);
  };

  if (!name) {
    return NextResponse.json({ success: false, message: "Название обязательно" }, { status: 400 });
  }
  const basePrice = parsePrice(price);
  if (sizeType === "NONE" && !basePrice) {
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
            const sizeIds = Array.isArray(group?.sizeIds) ? group.sizeIds.map(Number).filter(Number.isFinite) : [];
            const sizeClIds = Array.isArray(group?.sizeClIds)
              ? group.sizeClIds.map(Number).filter(Number.isFinite)
              : [];
            return { price: groupPrice, sizeIds, sizeClIds };
          })
          .filter((group: any) => group.price && (group.sizeIds.length || group.sizeClIds.length));

  if (sizeType !== "NONE" && normalizedGroups.length === 0) {
    return NextResponse.json(
      { success: false, message: "Добавьте хотя бы одну группу размеров с ценой" },
      { status: 400 }
    );
  }

  const minGroupPrice =
    normalizedGroups.length > 0 ? Math.min(...normalizedGroups.map((g: any) => Number(g.price))) : null;
  const finalPrice = sizeType === "NONE" ? basePrice : minGroupPrice;

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

  if (sizeType !== "NONE" && normalizedGroups.length) {
    const sizeIds = new Set<number>();
    const sizeClIds = new Set<number>();
    const createItems = normalizedGroups.flatMap((group: any) => {
      const rows: Array<{ price: number; productId: number; sizeId?: number; sizeClId?: number }> = [];
      if (sizeType === "SHOE") {
        for (const id of group.sizeIds) {
          sizeIds.add(id);
          rows.push({ price: group.price, productId: product.id, sizeId: id });
        }
      }
      if (sizeType === "CLOTH") {
        for (const id of group.sizeClIds) {
          sizeClIds.add(id);
          rows.push({ price: group.price, productId: product.id, sizeClId: id });
        }
      }
      return rows;
    });

    if (createItems.length) {
      await prisma.productItem.createMany({ data: createItems });
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
