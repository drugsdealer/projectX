import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BrandClient from '@/components/ui/BrandClient';
import type { Brand, Product } from '@prisma/client';
import type { Metadata } from 'next';
import { safeJsonLd } from '@/lib/json-ld';
import { withDbRetry } from '@/lib/db-retry';

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function generateStaticParams() {
  try {
    const brands = await withDbRetry(
      () => prisma.brand.findMany({
        where: { deletedAt: null },
        select: { slug: true },
        take: 200,
      }),
      { retries: 2, timeoutMs: 10000, label: 'brand static params' }
    );
    return brands.map((b) => ({ slug: b.slug }));
  } catch {
    // DB unavailable at build time — pages will be generated on first request via ISR
    return [];
  }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await withDbRetry(
    () => prisma.brand.findFirst({
      where: { slug: { equals: slug.trim().toLowerCase(), mode: 'insensitive' } },
      select: { name: true, description: true, logoUrl: true },
    }),
    { retries: 2, timeoutMs: 8000, label: `brand metadata ${slug}` }
  ).catch(() => null);
  if (!brand) return {};
  const description = brand.description || `Коллекция бренда ${brand.name} в Stage Store. Оригинальная брендовая одежда и аксессуары с доставкой по России.`;
  const images = brand.logoUrl ? [{ url: brand.logoUrl, width: 400, height: 400, alt: brand.name }] : [];
  return {
    title: brand.name,
    description,
    alternates: {
      canonical: `${SITE_URL}/brand/${slug}`,
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/brand/${slug}`,
      title: `${brand.name} — Stage Store`,
      description,
      images,
    },
  };
}

type BrandMeta = {
  id?: number;
  logo?: string;
  about?: string;
  aboutLong?: string;
  heroVideo?: string;
  tags?: string[];
};

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // 1) Ищем сам бренд по slug (регистронезависимо)
  const norm = slug.trim().toLowerCase();
  let dbUnavailable = false;
  const brand = await withDbRetry(
    () => prisma.brand.findFirst({
      where: { slug: { equals: norm, mode: 'insensitive' } },
    }),
    { retries: 2, timeoutMs: 8000, label: `brand page ${norm}` }
  ).catch(() => {
    dbUnavailable = true;
    return null;
  });

  // Если бренда нет — 404
  if (!brand) {
    if (dbUnavailable) {
      const fallbackName = norm
        .split("-")
        .filter(Boolean)
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(" ") || "Brand";

      return (
        <BrandClient
          items={[]}
          brandName={fallbackName}
          meta={{ tags: [] }}
          slug={norm}
        />
      );
    }
    notFound();
  }

  // 2) Подтягиваем товары бренда (может быть пусто — это ок)
  const productsRaw = await withDbRetry(
    () => prisma.product.findMany({
      where: { brandId: brand.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        price: true,
        oldPrice: true,
        imageUrl: true,
        images: true,
        description: true,
        available: true,
        premium: true,
        badge: true,
        gender: true,
        subcategory: true,
        sizeType: true,
        material: true,
        features: true,
        styleNotes: true,
        widthCm: true,
        heightCm: true,
        depthCm: true,
        categoryId: true,
        brandId: true,
        colorId: true,
        createdAt: true,
        updatedAt: true,
        Brand: true,
        Category: { select: { name: true, slug: true } },
      },
    }),
    { retries: 2, timeoutMs: 10000, label: `brand products ${brand.id}` }
  ).catch(() => []);

  type BrandItemDTO = Omit<Product, 'images'> & {
    images: string[];
    Brand: Brand | null;
    Category: { name: string; slug: string } | null;
  };

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
    id: brand.id,
    logo: brand.logoUrl || undefined,
    about: brand.description || undefined,
    aboutLong: brand.aboutLong || undefined,
    heroVideo: Array.isArray(brand.tags)
      ? brand.tags.find((tag) => typeof tag === 'string' && /^video:/i.test(tag.trim()))?.replace(/^video:/i, '').trim()
      : undefined,
    tags: Array.isArray(brand.tags) ? brand.tags : [],
  };

  const brandName = brand.name;
  const brandSlug = brand.slug ?? norm;

  const brandJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Весь каталог", item: `${SITE_URL}/search` },
          { "@type": "ListItem", position: 3, name: brandName, item: `${SITE_URL}/brand/${brandSlug}` },
        ],
      },
      {
        "@type": "Brand",
        "@id": `${SITE_URL}/brand/${brandSlug}/#brand`,
        name: brandName,
        url: `${SITE_URL}/brand/${brandSlug}`,
        ...(brand.logoUrl ? { logo: { "@type": "ImageObject", url: brand.logoUrl } } : {}),
        ...(brand.description ? { description: brand.description } : {}),
      },
      {
        "@type": "CollectionPage",
        name: `${brandName} — Stage Store`,
        url: `${SITE_URL}/brand/${brandSlug}`,
        description: brand.description || `Коллекция бренда ${brandName} в Stage Store.`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/brand/${brandSlug}/#brand` },
        numberOfItems: brandItems.length,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(brandJsonLd) }}
      />
      <BrandClient
        items={brandItems}
        brandName={brandName}
        meta={meta}
        slug={brandSlug}
      />
    </>
  );
}
