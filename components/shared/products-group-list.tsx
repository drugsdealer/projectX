'use client';

import React from 'react';
import { useIntersection } from 'react-use';

import { Title } from './title';
import { cn } from '@/lib/utils';
import { ProductCard } from './product-card';
import { useCategoryStore } from '@/store/category';

interface Product {
  id: number;
  name: string;
  images?: string[];
  brandLogo?: string;
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
  }, [categoryId, intersection?.isIntersecting, title]);

  // 🔥 фильтрация списка
  const filteredItems = items.filter((product) => {
    if (onlyPremium && !product.isPremium) return false;
    if (!onlyPremium && product.isPremium) return false;
    if (genderFilter && product.gender && product.gender !== genderFilter && product.gender !== 'unisex') {
      return false;
    }
    return true;
  });

  return (
    <div className={className} id={title} ref={intersectionRef}>
      <Title text={title} size="lg" className="font-extrabold mb-5" />

      <div className={cn('grid grid-cols-3 gap-[50px]', listClassName)}>
        {filteredItems.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            images={product.images}
            brandLogo={product.brandLogo}
            price={product.price}
            variants={product.variants}
            sizes={product.sizes}
          />
        ))}
      </div>
    </div>
  );
};