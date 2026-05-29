import { Suspense } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { productPath } from "@/lib/product-url";
import { getOptimizedImageUrl, shouldBypassNextImageOptimization } from "@/lib/media";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";
const SAFARI_PRODUCT_IDS = [356, 350, 354, 355, 351, 359];

const SAFARI_HERO_IMAGE =
  "https://ik.imagekit.io/qowmy92ny/ChatGPT%20Image%2026%20%D0%BC%D0%B0%D1%8F%202026%20%D0%B3.,%2022_23_13.png";

export const metadata: Metadata = {
  title: "Зов саванны — подборка Stage Store",
  description:
    "Леопардовые, зебровые и анималистичные принты — подборка обуви и аксессуаров Зов саванны в Stage Store.",
  alternates: {
    canonical: `${SITE_URL}/collection/safari`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/collection/safari`,
    title: "Зов саванны — подборка Stage Store",
    description: "Анималистичные принты: леопард, зебра, корова. Выбор редакции.",
    images: [{ url: SAFARI_HERO_IMAGE, width: 1200, height: 630, alt: "Зов саванны" }],
  },
};

async function SafariCollectionPage() {
  const rawProducts = await prisma.product.findMany({
    where: { id: { in: SAFARI_PRODUCT_IDS }, deletedAt: null },
    select: {
      id: true,
      name: true,
      price: true,
      oldPrice: true,
      imageUrl: true,
      images: true,
      available: true,
      badge: true,
      Brand: { select: { id: true, name: true, slug: true } },
    },
  });

  // Preserve the original order
  const byId = new Map(rawProducts.map((p) => [p.id, p]));
  const products = SAFARI_PRODUCT_IDS.map((id) => byId.get(id)).filter(Boolean) as typeof rawProducts;

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative w-full overflow-hidden" style={{ height: "56vw", maxHeight: 560, minHeight: 260 }}>
        <Image
          src={SAFARI_HERO_IMAGE}
          alt="Зов саванны — анималистичные принты"
          fill
          priority
          sizes="100vw"
          className="object-cover"
          unoptimized={shouldBypassNextImageOptimization(SAFARI_HERO_IMAGE)}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

        {/* Text */}
        <div className="absolute inset-x-0 bottom-0 px-6 pb-8 sm:px-12 sm:pb-12">
          <p
            className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-white/70"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
          >
            Подборка Stage Store
          </p>
          <h1
            className="text-4xl sm:text-5xl font-black tracking-[-0.03em] text-white leading-none"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.35)" }}
          >
            Зов саванны
          </h1>
          <p
            className="mt-2 text-sm sm:text-base text-white/85 max-w-md"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
          >
            Леопард. Зебра. Ничего лишнего.
          </p>
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
          {products.map((product) => {
            const imagesArr = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
            const mainImage = product.imageUrl || imagesArr[0] || null;
            const optimizedSrc = mainImage
              ? getOptimizedImageUrl(mainImage, { width: 640, quality: 82 })
              : null;
            const bypass = mainImage ? shouldBypassNextImageOptimization(mainImage) : false;
            const href = productPath({
              id: product.id,
              name: product.name,
              brandName: product.Brand?.name ?? undefined,
            });
            const hasDiscount = product.oldPrice && product.oldPrice > (product.price ?? 0);

            return (
              <Link
                key={product.id}
                href={href}
                className="group rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5 hover:ring-black/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Image */}
                <div className="relative aspect-square bg-white overflow-hidden">
                  {optimizedSrc ? (
                    <Image
                      src={optimizedSrc}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-contain p-3"
                      unoptimized={bypass}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                  {product.badge && (
                    <span className="absolute top-2 left-2 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      {product.badge}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  {product.Brand?.name && (
                    <div className="text-[10px] uppercase tracking-wide text-black/50 leading-none mb-1">
                      {product.Brand.name}
                    </div>
                  )}
                  <h2 className="font-semibold text-sm leading-snug line-clamp-2">
                    {product.name}
                  </h2>
                  {product.price != null && (
                    <div className="mt-2 flex items-baseline gap-2">
                      {hasDiscount && (
                        <span className="text-[11px] text-gray-400 line-through">
                          {product.oldPrice!.toLocaleString("ru-RU")} ₽
                        </span>
                      )}
                      <span className="text-sm font-semibold">
                        от {product.price.toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer link back */}
        <div className="mt-12 text-center">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:border-black hover:text-black transition"
          >
            Весь каталог →
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SafariPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
          Загрузка…
        </div>
      }
    >
      <SafariCollectionPage />
    </Suspense>
  );
}
