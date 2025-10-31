'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export type Collab = {
  slug: string;
  partners: string[];
  brandLogos?: string[]; // соответствуют индексам partners
  primaryIndex?: number; // какой партнёр считается флагманом (по умолчанию 0)
};

export interface CollabBadgeProps {
  collab?: Collab;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Небольшой бейдж коллаборации:
 *  - Слева чип с флагманским брендом (логотип + название)
 *  - Рядом капсула "+N бренд(а/ов)"; при ховере/табе/клике раскрывается поповер со второстепенными брендами
 */
const CollabBadge: React.FC<CollabBadgeProps> = ({ collab, className = '', align = 'left' }) => {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  const primaryIndex = collab?.primaryIndex ?? 0;

  const primary = useMemo(() => {
    if (!collab) return null;
    const name = collab.partners?.[primaryIndex] ?? collab.partners?.[0];
    const logo = collab.brandLogos?.[primaryIndex];
    return { name, logo };
  }, [collab, primaryIndex]);

  const secondary = useMemo(() => {
    if (!collab) return [] as { name: string; logo?: string }[];
    return collab.partners
      .map((name, i) => ({ name, logo: collab.brandLogos?.[i] }))
      .filter((_, i) => i !== primaryIndex);
  }, [collab, primaryIndex]);

  const count = secondary.length;

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!collab || !primary?.name) return null;

  const plural = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'бренд';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'бренда';
    return 'брендов';
  };

  const justify = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  return (
    <div className={`relative flex ${justify} gap-2 select-none ${className}`}>
      {/* Флагманский бренд */}
      <div className="inline-flex items-center gap-2 rounded-full bg-white/85 backdrop-blur px-3 py-1 shadow-sm ring-1 ring-black/5">
        {primary.logo ? (
          <Image
            src={primary.logo}
            alt={primary.name}
            width={18}
            height={18}
            className="object-contain"
          />
        ) : null}
        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{primary.name}</span>
      </div>

      {/* Второстепенные бренды */}
      {count > 0 && (
        <div
          className="relative"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((s) => !s)}
            className="inline-flex items-center rounded-full bg-gray-900 text-white/95 hover:text-white px-3 py-1 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-black/20"
          >
            +{count} {plural(count)}
          </button>

          {open && (
            <div
              ref={popRef}
              className="absolute z-30 mt-2 w-64 -left-2 sm:left-0 origin-top-left rounded-xl bg-white/95 backdrop-blur shadow-lg ring-1 ring-black/5 p-2 animate-in fade-in zoom-in-95"
            >
              <div className="max-h-64 overflow-auto">
                {secondary.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-black/[0.03]">
                    {b.logo ? (
                      <Image src={b.logo} alt={b.name} width={20} height={20} className="object-contain" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-gray-200" />
                    )}
                    <span className="text-sm text-gray-900">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default async function CollabPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  const products = await prisma.product.findMany({
    where: {
      brand: {
        slug,
      },
    },
    include: {
      brand: true,
      images: true,
    },
  });

  if (!products || products.length === 0) {
    notFound();
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Товары бренда {products[0].brand.name}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white shadow rounded-lg overflow-hidden">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-60 object-cover"
            />
            <div className="p-4">
              <h2 className="text-lg font-medium">{product.name}</h2>
              <p className="text-gray-600">{product.price} ₽</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}