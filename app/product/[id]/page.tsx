import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import ProductPageClient from "./ProductPageClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId) || productId <= 0) return {};

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      Brand: { select: { name: true } },
      Category: { select: { name: true } },
    },
  });

  if (!product) return {};

  const brandName = product.Brand?.name;
  const title = brandName ? `${product.name} ${brandName}` : product.name;
  const price = product.price ? `${Number(product.price).toLocaleString("ru-RU")} ₽` : "";
  const description = product.description
    ? product.description.slice(0, 160)
    : `${title}${price ? ` — ${price}` : ""} в интернет-магазине Stage Store. Оригинал с гарантией подлинности.`;

  const images = product.imageUrl ? [{ url: product.imageUrl, width: 800, height: 800, alt: title }] : [];

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title: `${title} — Stage Store`,
      description,
      url: `${SITE_URL}/product/${id}`,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Stage Store`,
      description,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
    alternates: {
      canonical: `${SITE_URL}/product/${id}`,
    },
  };
}

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return products.map((p) => ({ id: String(p.id) }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);

  let jsonLd: object | null = null;

  if (Number.isFinite(productId) && productId > 0) {
    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        name: true,
        price: true,
        imageUrl: true,
        description: true,
        Brand: { select: { name: true } },
        Category: { select: { name: true, slug: true } },
      },
    });

    if (p) {
      const brandName = p.Brand?.name;
      const categoryName = p.Category?.name;
      const categorySlug = p.Category?.slug;

      jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
              ...(categoryName && categorySlug
                ? [{ "@type": "ListItem", position: 2, name: categoryName, item: `${SITE_URL}/category/${categorySlug}` }]
                : []),
              { "@type": "ListItem", position: categorySlug ? 3 : 2, name: p.name, item: `${SITE_URL}/product/${id}` },
            ],
          },
          {
            "@type": "Product",
            name: p.name,
            url: `${SITE_URL}/product/${id}`,
            ...(p.imageUrl ? { image: p.imageUrl } : {}),
            ...(p.description ? { description: p.description.slice(0, 300) } : {}),
            ...(brandName ? { brand: { "@type": "Brand", name: brandName } } : {}),
            ...(p.price
              ? {
                  offers: {
                    "@type": "Offer",
                    price: Number(p.price),
                    priceCurrency: "RUB",
                    availability: "https://schema.org/InStock",
                    seller: { "@type": "Organization", name: "Stage Store" },
                  },
                }
              : {}),
          },
        ],
      };
    }
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Suspense>
        <ProductPageClient />
      </Suspense>
    </>
  );
}
