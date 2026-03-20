import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import ProductPageClient from "./ProductPageClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.ru";

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

export default function ProductPage() {
  return <ProductPageClient />;
}
