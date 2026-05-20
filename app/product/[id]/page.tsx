import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import ProductPageClient from "./ProductPageClient";
import { safeJsonLd } from "@/lib/json-ld";
import { withDbRetry } from "@/lib/db-retry";
import { parseProductPathId, productPath } from "@/lib/product-url";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const productId = parseProductPathId(id);
  if (!productId) return {};

  const product = await withDbRetry(
    () => prisma.product.findUnique({
      where: { id: productId },
      select: {
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        Brand: { select: { name: true } },
        Category: { select: { name: true } },
      },
    }),
    { retries: 2, timeoutMs: 8000, label: `product metadata ${productId}` }
  ).catch(() => null);

  if (!product) return {};

  const brandName = product.Brand?.name;
  const title = brandName ? `${product.name} ${brandName}` : product.name;
  const prettyPath = productPath({ id: productId, name: product.name, brandName });
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
      url: `${SITE_URL}${prettyPath}`,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Stage Store`,
      description,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
    alternates: {
      canonical: `${SITE_URL}${prettyPath}`,
    },
  };
}

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function generateStaticParams() {
  try {
    const products = await withDbRetry(
      () => prisma.product.findMany({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      { retries: 2, timeoutMs: 10000, label: "product static params" }
    );
    return products.map((p) => ({ id: String(p.id) }));
  } catch {
    return [];
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = parseProductPathId(id);

  let jsonLd: object | null = null;

  if (productId) {
    const p = await withDbRetry(
      () => prisma.product.findUnique({
        where: { id: productId },
        select: {
          name: true,
          price: true,
          imageUrl: true,
          description: true,
          Brand: { select: { name: true } },
          Category: { select: { name: true, slug: true } },
        },
      }),
      { retries: 2, timeoutMs: 8000, label: `product json-ld ${productId}` }
    ).catch(() => null);

    if (p) {
      const brandName = p.Brand?.name;
      const categoryName = p.Category?.name;
      const categorySlug = p.Category?.slug;
      const prettyPath = productPath({ id: productId, name: p.name, brandName });

      const productDescription = p.description
        ? p.description.slice(0, 5000)
        : `${p.name}${brandName ? ` от ${brandName}` : ""} — купить в интернет-магазине Stage Store. Оригинал с гарантией подлинности.`;

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
              { "@type": "ListItem", position: categorySlug ? 3 : 2, name: p.name, item: `${SITE_URL}${prettyPath}` },
            ],
          },
          {
            "@type": "Product",
            name: p.name,
            url: `${SITE_URL}${prettyPath}`,
            image: p.imageUrl || `${SITE_URL}/img/placeholder.svg`,
            description: productDescription,
            brand: {
              "@type": "Brand",
              name: brandName || "Stage Store",
            },
            ...(p.price
              ? {
                  offers: {
                    "@type": "Offer",
                    price: Number(p.price),
                    priceCurrency: "RUB",
                    url: `${SITE_URL}${prettyPath}`,
                    availability: "https://schema.org/InStock",
                    itemCondition: "https://schema.org/NewCondition",
                    seller: {
                      "@type": "Organization",
                      name: "Stage Store",
                      url: SITE_URL,
                    },
                    shippingDetails: {
                      "@type": "OfferShippingDetails",
                      shippingDestination: {
                        "@type": "DefinedRegion",
                        addressCountry: "RU",
                      },
                      shippingRate: {
                        "@type": "MonetaryAmount",
                        value: "0",
                        currency: "RUB",
                      },
                      deliveryTime: {
                        "@type": "ShippingDeliveryTime",
                        handlingTime: {
                          "@type": "QuantitativeValue",
                          minValue: 1,
                          maxValue: 3,
                          unitCode: "DAY",
                        },
                        transitTime: {
                          "@type": "QuantitativeValue",
                          minValue: 1,
                          maxValue: 7,
                          unitCode: "DAY",
                        },
                      },
                    },
                    hasMerchantReturnPolicy: {
                      "@type": "MerchantReturnPolicy",
                      applicableCountry: "RU",
                      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
                      merchantReturnDays: 14,
                      returnMethod: "https://schema.org/ReturnByMail",
                      returnFees: "https://schema.org/FreeReturn",
                    },
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
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
      )}
      <Suspense fallback={
        <div className="w-full h-screen flex items-center justify-center">
          <p className="text-xl text-gray-400">Загрузка товара...</p>
        </div>
      }>
        <ProductPageClient />
      </Suspense>
    </>
  );
}
