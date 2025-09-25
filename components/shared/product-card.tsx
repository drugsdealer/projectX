'use client';

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

interface Variant {
  price: number;
  images: string[];
  brand?: string;
}

interface Props {
  id: number;
  name: string;
  price?: number;
  images?: string[];
  brandLogo?: string;
  brand?: string;
  variants?: Record<string, Variant>;
  sizes?: {
    prices?: Record<string | number, number>;
  };
  premium?: boolean;
  premiumBadgeIcon?: string;
}

// 🔧 Вынесенная функция для минимальной цены
const getMinPrice = (product: Props): number => {
  const pricesFromSizes = product.sizes?.prices;
  if (pricesFromSizes && typeof pricesFromSizes === 'object') {
    const values = Object.values(pricesFromSizes).filter((p): p is number => typeof p === 'number');
    if (values.length > 0) return Math.min(...values);
  }

  const variantPrices = Object.values(product.variants || {}).map(v => v.price);
  if (variantPrices.length > 0) return Math.min(...variantPrices);

  return product.price || 0;
};

const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

export const ProductCard: React.FC<Props> = ({
  id,
  name,
  price,
  images,
  brandLogo,
  brand,
  variants,
  sizes,
  premium,
  premiumBadgeIcon
}) => {
  const variantEntries = variants ? Object.entries(variants) : [];
  const [randomColor, randomVariant] = variantEntries.length > 0
    ? variantEntries[Math.floor(Math.random() * variantEntries.length)]
    : [null, null];

  const imageList = randomVariant?.images || images || ["/img/fallback.jpg"];

  // Determine brand for "More from brand" button, fallback to variants brand if no brand prop
  let brandForButton = brand;
  if (!brandForButton) {
    if (randomVariant?.brand) {
      brandForButton = randomVariant.brand;
    } else if (variants) {
      for (const v of Object.values(variants)) {
        if (v.brand) {
          brandForButton = v.brand;
          break;
        }
      }
    }
  }

  const [hovered, setHovered] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (hovered && imageList.length > 1) {
      intervalRef.current = setInterval(() => {
        setImageIndex((prev) => (prev + 1) % imageList.length);
      }, 1000);
    } else {
      setImageIndex(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hovered, imageList.length]);

  const displayImage = imageList[imageIndex];
  const displayPrice = getMinPrice({ id, name, price, images, brandLogo, variants, sizes });

  return (
    <Link
      href={`/product/${id}${randomColor ? `?color=${randomColor}` : ""}`}
      className="block"
      id={`product-${id}`}
      data-product-id={id}
      onClick={() => {
        try {
          // запоминаем контекст листинга, чтобы вернуться к нужной карточке
          sessionStorage.setItem('lastListRoute', window.location.pathname + window.location.search);
          sessionStorage.setItem('lastScrollY', String(window.scrollY));
          sessionStorage.setItem('lastProductId', String(id));
          // не меняем lastSection/lastGender тут — их задаёт страница товара
        } catch {}
      }}
    >
      <div
        className="border p-4 rounded-lg cursor-pointer hover:shadow-lg transition"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative w-full h-[300px] rounded overflow-hidden">
          <Image
            src={displayImage}
            alt={name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>

        <div className="flex items-center gap-2 mt-3">
          {brandLogo && brandForButton && (
            <Link
              href={`/brand/${slugify(brandForButton)}?origin=product`}
              className="w-10 h-10 relative p-0 border-0 bg-transparent inline-block"
              aria-label={`Перейти к бренду ${brandForButton}`}
              onClick={(e) => {
                // не даём клику по логотипу проваливаться на карточку товара
                e.stopPropagation();
              }}
            >
              <Image src={brandLogo} alt={brandForButton} fill className="object-contain" />
            </Link>
          )}
          <h3 className="font-bold text-xs md:text-sm line-clamp-2 inline-flex items-center gap-1">
            {name}
            {premium && (
              <Image
                src={premiumBadgeIcon || "/img/star-icon.png"}
                alt="Premium badge"
                width={14}
                height={14}
                className="inline-block align-baseline"
              />
            )}
          </h3>
        </div>

        {brandForButton && (
          <div className="mt-2">
            <Link
              href={`/brand/${slugify(brandForButton)}?origin=product`}
              className="text-[11px] md:text-xs font-semibold text-gray-700 hover:text-black underline underline-offset-2"
              aria-label={`Больше от бренда ${brandForButton}`}
              onClick={(e) => e.stopPropagation()}
            >
              Больше от бренда
            </Link>
          </div>
        )}

        <p className="text-gray-500 mt-1">от {displayPrice}₽</p>
      </div>
    </Link>
  );
};