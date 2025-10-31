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

  return (
    <div className={className} id={title} ref={intersectionRef}>
      <Title text={title} size="lg" className="font-extrabold mb-5" />

      <div
        className={cn(
          'grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-[50px]',
          listClassName
        )}
      >
        {filteredItems.map((product) => (
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
