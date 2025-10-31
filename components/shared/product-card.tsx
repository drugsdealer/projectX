'use client';

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  primaryImage?: string | null;
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
  primaryImage,
  brandLogo,
  brand,
  variants,
  sizes,
  premium,
  premiumBadgeIcon
}) => {
  // Детеминированный выбор варианта по цвету (никакого рандома — стабильные URL и поведение)
  const variantEntries = useMemo(
    () => (variants ? Object.entries(variants) : []),
    [variants]
  );

  const [selectedColorKey, selectedVariant] = useMemo(() => {
    if (!variantEntries.length) return [null, null] as const;
    // сортируем ключи, чтобы всегда брать один и тот же вариант для карточки
    const sorted = [...variantEntries].sort(([a], [b]) =>
      String(a).localeCompare(String(b))
    );
    return [sorted[0][0], sorted[0][1]] as const;
  }, [variantEntries]);

  // Список изображений: первая (обложка) ВСЕГДА берётся из images[0], если он есть.
  // Это фиксит кейс, когда "preview начинается со 2-й фотки", потому что где-то прокидывается primaryImage != images[0].
  const imageList: string[] = useMemo(() => {
    const merged: string[] = [];
    const pushUnique = (src?: string | null) => {
      if (!src) return;
      if (merged.includes(src)) return;
      merged.push(src);
    };

    // cover: сначала primaryImage (если есть) -> images[0] -> variant[0] -> fallback
    // primaryImage обычно хранит «главную» фотку (imageUrl) из админки/сида.
    const cover =
      primaryImage ||
      (images && images.length > 0 ? images[0] : null) ||
      (selectedVariant?.images?.length ? selectedVariant.images[0] : null) ||
      "/img/fallback.jpg";

    // 1) обложка первой
    pushUnique(cover);

    // 2) все images (сохраняем порядок из массива)
    if (images && images.length > 0) {
      images.forEach((img) => pushUnique(img));
    }

    // 3) primaryImage (если не попала выше) — на всякий случай
    pushUnique(primaryImage);

    // 4) вариантные картинки, если чего-то не хватило
    if (selectedVariant?.images?.length) {
      selectedVariant.images.forEach((img: string) => pushUnique(img));
    }

    // 5) абсолютный fallback
    if (merged.length === 0) pushUnique("/img/fallback.jpg");

    return merged;
  }, [primaryImage, images, selectedVariant]);

  // Бренд для кнопки «Больше от бренда», сначала из пропса, потом из варианта, потом из других вариантов
  const brandForButton = useMemo(() => {
    if (brand) return brand;
    if (selectedVariant?.brand) return selectedVariant.brand;
    if (variants) {
      for (const v of Object.values(variants)) {
        if (v.brand) {
          return v.brand;
        }
      }
    }
    return undefined;
  }, [brand, selectedVariant, variants]);

  const [hovered, setHovered] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [isFinePointer, setIsFinePointer] = useState(false);
  const lastXRef = useRef<number | null>(null);
  const lastMoveTimeRef = useRef<number>(0);

  const pointerDownRef = useRef(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lastSwipeAtRef = useRef<number>(0);
  const didSwipeRef = useRef(false);

  const SWIPE_THRESHOLD_PX = 32;
  const SWIPE_COOLDOWN_MS = 140;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(pointer: fine)");
    const updatePointer = () => setIsFinePointer(media.matches);
    updatePointer();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", updatePointer);
      return () => media.removeEventListener("change", updatePointer);
    } else {
      media.addListener(updatePointer);
      return () => media.removeListener(updatePointer);
    }
  }, []);

  useEffect(() => {
    if (!hovered) {
      setImageIndex(0);
      lastXRef.current = null;
      didSwipeRef.current = false;
    }
  }, [hovered]);

  useEffect(() => {
    setImageIndex(0);
    lastXRef.current = null;
    didSwipeRef.current = false;
  }, [id, imageList.length]);

  const displayImage = imageList[imageIndex];

  const bumpIndex = (dir: 1 | -1) => {
    if (imageList.length <= 1) return;
    setImageIndex((prev) => {
      const next = (prev + dir + imageList.length) % imageList.length;
      return next;
    });
  };

  const displayPrice = useMemo(
    () =>
      getMinPrice({
        id,
        name,
        price,
        images,
        primaryImage,
        brandLogo,
        brand,
        variants,
        sizes,
        premium,
        premiumBadgeIcon,
      }),
    [
      id,
      name,
      price,
      images,
      primaryImage,
      brandLogo,
      brand,
      variants,
      sizes,
      premium,
      premiumBadgeIcon,
    ]
  );

  return (
    <Link
      href={`/product/${id}${selectedColorKey ? `?color=${encodeURIComponent(String(selectedColorKey))}` : ""}`}
      className="block group"
      id={`product-${id}`}
      data-product-id={id}
      onClick={(e) => {
        // если пользователь свайпнул по фото — не открываем карточку
        if (didSwipeRef.current) {
          e.preventDefault();
          e.stopPropagation();
          // сбросим флаг, чтобы следующий обычный тап открыл товар
          didSwipeRef.current = false;
          return;
        }

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
        onMouseLeave={() => {
          setHovered(false);
          lastXRef.current = null;
        }}
        onMouseMove={(event) => {
          if (!isFinePointer || imageList.length <= 1) return;
          if (!hovered) return;
          const now = performance.now();
          if (now - lastMoveTimeRef.current < 90) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const relativeX = event.clientX - bounds.left;
          if (lastXRef.current === null) {
            lastXRef.current = relativeX;
            return;
          }
          const delta = relativeX - lastXRef.current;
          if (Math.abs(delta) < bounds.width * 0.05) return;
          lastMoveTimeRef.current = now;
          lastXRef.current = relativeX;
          setImageIndex((prev) => {
            if (delta > 0) {
              return (prev + 1) % imageList.length;
            }
            return (prev - 1 + imageList.length) % imageList.length;
          });
        }}
      >
        <div
          className="relative w-full h-[300px] rounded overflow-hidden"
          style={{
            // позволяем вертикальный скролл страницы, но ловим горизонтальные жесты
            touchAction: imageList.length > 1 ? "pan-y" : "auto",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          onPointerDown={(e) => {
            // на десктопе оставляем старое поведение (hover/mousemove), свайп нужен только для touch
            if (e.pointerType !== "touch") return;
            if (imageList.length <= 1) return;

            pointerDownRef.current = true;
            startXRef.current = e.clientX;
            startYRef.current = e.clientY;
            // чтобы жест не превратился в клик по ссылке
            didSwipeRef.current = false;

            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {}
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch") return;
            if (!pointerDownRef.current) return;
            if (imageList.length <= 1) return;
            if (startXRef.current == null || startYRef.current == null) return;

            const dx = e.clientX - startXRef.current;
            const dy = e.clientY - startYRef.current;

            // если пользователь больше скроллит вверх/вниз — не вмешиваемся
            if (Math.abs(dy) > Math.abs(dx)) return;

            const now = performance.now();
            if (now - lastSwipeAtRef.current < SWIPE_COOLDOWN_MS) return;

            if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
              lastSwipeAtRef.current = now;
              didSwipeRef.current = true;

              if (dx < 0) bumpIndex(1);
              else bumpIndex(-1);

              // ресетим старт, чтобы можно было листать дальше одним жестом
              startXRef.current = e.clientX;
              startYRef.current = e.clientY;
            }
          }}
          onPointerUp={(e) => {
            if (e.pointerType !== "touch") return;
            pointerDownRef.current = false;
            startXRef.current = null;
            startYRef.current = null;
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}

            // небольшой таймаут, чтобы тап сразу после свайпа не открыл товар
            if (didSwipeRef.current) {
              window.setTimeout(() => {
                didSwipeRef.current = false;
              }, 250);
            }
          }}
          onPointerCancel={(e) => {
            if (e.pointerType !== "touch") return;
            pointerDownRef.current = false;
            startXRef.current = null;
            startYRef.current = null;
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
          }}
        >
          <Image
            src={displayImage}
            alt={name}
            fill
            draggable={false}
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
