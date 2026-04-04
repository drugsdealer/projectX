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
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
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
              { "@type": "ListItem", position: categorySlug ? 3 : 2, name: p.name, item: `${SITE_URL}/product/${id}` },
            ],
          },
          {
            "@type": "Product",
            name: p.name,
            url: `${SITE_URL}/product/${id}`,
            image: p.imageUrl || `${SITE_URL}/img/placeholder.png`,
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
                    url: `${SITE_URL}/product/${id}`,
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Suspense>
        <ProductPageClient />
      </Suspense>
    </>
  );
}
