import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BrandClient from '@/components/ui/BrandClient';
import type { Brand, Product } from '@prisma/client';

type BrandMeta = {
  logo?: string;
  about?: string;
  aboutLong?: string;
  tags?: string[];
};

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // 1) Ищем сам бренд по slug (регистронезависимо)
  const norm = slug.trim().toLowerCase();
  const brand = await prisma.brand.findFirst({
    where: { slug: { equals: norm, mode: 'insensitive' } },
  });

  // Если бренда нет — 404
  if (!brand) {
    notFound();
  }

  // 2) Подтягиваем товары бренда (может быть пусто — это ок)
  const productsRaw = await prisma.product.findMany({
    where: { brandId: brand.id, deletedAt: null },
    include: { Brand: true },
  });

  type BrandItemDTO = Omit<Product, 'images'> & { images: string[]; Brand: Brand | null };

  const brandItems: BrandItemDTO[] = productsRaw.map((p: any) => {
    const fromField = Array.isArray((p as any).images) ? ((p as any).images as string[]) : [];
    const fallback = p.imageUrl ? [p.imageUrl as string] : [];
    const images = fromField.length ? fromField : fallback;
    return { ...p, images } as BrandItemDTO;
  });

  // 3) Собираем мету для клиентского компонента
  const meta: BrandMeta = {
    logo: brand.logoUrl || undefined,
    about: brand.description || undefined,
    aboutLong: brand.aboutLong || undefined,
    tags: Array.isArray(brand.tags) ? brand.tags : [],
  };

  const brandName = brand.name;
  const brandSlug = brand.slug ?? norm;

  return (
    <BrandClient
      items={brandItems}
      brandName={brandName}
      meta={meta}
      slug={brandSlug}
      brandId={brand.id}
    />
  );
}
