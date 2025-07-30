'use client';

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

interface Variant {
  price: number;
  images: string[];
}

interface Props {
  id: number;
  name: string;
  price?: number;
  images?: string[];
  brandLogo?: string;
  variants?: Record<string, Variant>;
  sizes?: {
    prices?: Record<string | number, number>;
  };
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

export const ProductCard: React.FC<Props> = ({
  id,
  name,
  price,
  images,
  brandLogo,
  variants,
  sizes
}) => {
  const variantEntries = variants ? Object.entries(variants) : [];
  const [randomColor, randomVariant] = variantEntries.length > 0
    ? variantEntries[Math.floor(Math.random() * variantEntries.length)]
    : [null, null];

  const imageList = randomVariant?.images || images || ["/img/fallback.jpg"];

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
    <Link href={`/product/${id}${randomColor ? `?color=${randomColor}` : ""}`} className="block">
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
          {brandLogo && (
            <div className="w-10 h-10 relative">
              <Image src={brandLogo} alt="Бренд" fill className="object-contain" />
            </div>
          )}
          <h3 className="font-bold text-xs md:text-sm line-clamp-2">{name}</h3>
        </div>

        <p className="text-gray-500 mt-1">от ${displayPrice}</p>
      </div>
    </Link>
  );
};