import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BrandClient from '@/components/ui/BrandClient';
import type { Brand, Product } from '@prisma/client';
import type { Metadata } from 'next';

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function generateStaticParams() {
  const brands = await prisma.brand.findMany({
    where: { deletedAt: null },
    select: { slug: true },
    take: 200,
  });
  return brands.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await prisma.brand.findFirst({
    where: { slug: { equals: slug.trim().toLowerCase(), mode: 'insensitive' } },
    select: { name: true, description: true },
  });
  if (!brand) return {};
  const description = brand.description || `Коллекция бренда ${brand.name} в Stage Store. Оригинальная брендовая одежда и аксессуары.`;
  return {
    title: brand.name,
    description,
    openGraph: {
      title: `${brand.name} — Stage Store`,
      description,
    },
  };
}

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
    const mainUrl = typeof p.imageUrl === 'string' && p.imageUrl.trim() ? p.imageUrl.trim() : null;
    const fromField = Array.isArray((p as any).images)
      ? ((p as any).images as string[]).filter((s: string) => typeof s === 'string' && s.trim())
      : [];

    // imageUrl (главная фотка) всегда первая, остальные после неё без дублей
    const images: string[] = [];
    if (mainUrl) images.push(mainUrl);
    for (const src of fromField) {
      if (!images.includes(src)) images.push(src);
    }
    if (!images.length && mainUrl) images.push(mainUrl);

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
    />
  );
}
