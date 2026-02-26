'use client';

import React, { useMemo } from 'react';
import { useIntersection } from 'react-use';

import { Title } from './title';
import { cn } from '@/lib/utils';
import { ProductCard } from './product-card';
import { useCategoryStore } from '@/store/category';

interface Product {
  id: number;
  name: string;
  images?: string[];
  imageUrl?: string | null;
  brandLogo?: string;
  brand?: string;
  price?: number;
  variants?: any;
  sizes?: any;
  isPremium?: boolean;
  gender?: 'men' | 'women' | 'unisex';
}

interface Props {
  title: string;
  items: Product[];
  categoryId: number;
  className?: string;
  listClassName?: string;
  onlyPremium?: boolean;      // 🔥 показывать только премиум
  genderFilter?: 'men' | 'women' | 'unisex'; // 🔥 фильтрация по полу
}

export const ProductsGroupList: React.FC<Props> = ({
  title,
  items,
  listClassName,
  categoryId,
  className,
  onlyPremium,
  genderFilter,
}) => {
  const setActiveCategoryId = useCategoryStore((state) => state.setActiveId);
  const intersectionRef = React.useRef(null);
  const intersection = useIntersection(intersectionRef, {
    threshold: 0.4,
  });

  React.useEffect(() => {
    if (intersection?.isIntersecting) {
      setActiveCategoryId(categoryId);
    }
  }, [categoryId, intersection?.isIntersecting, setActiveCategoryId, title]);

  // 🔥 фильтрация списка (мемоизирована, чтобы не пересчитываться без надобности)
  const filteredItems = useMemo(
    () =>
      items.filter((product) => {
        // если включён режим "только премиум" — показываем только isPremium
        if (onlyPremium) {
          if (!product.isPremium) return false;
        } else {
          // в обычных подборках не выводим премиум‑товары
          if (product.isPremium) return false;
        }

        // фильтрация по полу: допускаем точное совпадение или 'unisex'
        if (
          genderFilter &&
          product.gender &&
          product.gender !== 'unisex' &&
          product.gender !== genderFilter
        ) {
          return false;
        }

        return true;
      }),
    [items, onlyPremium, genderFilter]
  );

  // ⚙️ Стабилизация ссылок на объекты/массивы, чтобы моб. превью не "сбрасывалось" на 1-ю фотку
  // (у некоторых превью-реализаций есть effect на `images`, который реагирует на смену reference)
  const productCacheRef = React.useRef<Record<number, Product>>({});

  const stableItems = useMemo(() => {
    const cache = productCacheRef.current;
    const alive: Record<number, true> = {};

    const out = filteredItems.map((p) => {
      alive[p.id] = true;
      const prev = cache[p.id];

      // нормализуем массив, чтобы reference не менялся из-за `undefined/null`
      const nextImgs = Array.isArray(p.images) ? p.images.filter(Boolean) : p.images;

      if (!prev) {
        const first: Product = {
          ...p,
          images: Array.isArray(nextImgs) ? nextImgs : undefined,
        };
        cache[p.id] = first;
        return first;
      }

      // обновляем поля, сохраняя объект
      prev.name = p.name;
      prev.imageUrl = p.imageUrl ?? null;
      prev.brandLogo = p.brandLogo;
      prev.brand = p.brand;
      prev.price = p.price;
      prev.variants = p.variants;
      prev.sizes = p.sizes;
      prev.isPremium = p.isPremium;
      prev.gender = p.gender;

      // обновляем `images` только если реально изменилось содержимое
      if (Array.isArray(nextImgs)) {
        const prevImgs = Array.isArray(prev.images) ? prev.images : [];
        const sameLen = prevImgs.length === nextImgs.length;
        const same = sameLen && prevImgs.every((v, i) => v === nextImgs[i]);
        if (!same) prev.images = nextImgs;
      } else {
        // если картинок нет — сбрасываем
        prev.images = undefined;
      }

      return prev;
    });

    // вычищаем кеш от товаров, которых больше нет в списке
    Object.keys(cache).forEach((k) => {
      const id = Number(k);
      if (!alive[id]) delete cache[id];
    });

    return out;
  }, [filteredItems]);

  return (
    <div className={className} id={title} ref={intersectionRef}>
      <Title text={title} size="lg" className="font-extrabold mb-5" />

      <div
        className={cn(
          'grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-[50px]',
          listClassName
        )}
      >
        {stableItems.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            images={product.images}
            primaryImage={product.imageUrl}
            brandLogo={product.brandLogo}
            brand={product.brand}
            price={product.price}
            variants={product.variants}
            sizes={product.sizes}
          />
        ))}
      </div>
    </div>
  );
};
