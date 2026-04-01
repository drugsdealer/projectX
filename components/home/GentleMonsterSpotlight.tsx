'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { HomePromoProduct } from '@/components/home/promos/types';

const BANNER =
  'https://res.cloudinary.com/dc57mpiao/image/upload/v1774993505/plp_0_pc_3840_1800_bnvuth.avif';
const BANNER_MOBILE =
  'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992864/story_1_campaign_imgs_pc_1600x1080_xkwj1s.avif';

const STATIC_PRODUCTS = [
  {
    id: 10001,
    name: 'ALIO 01',
    cat: 'Солнцезащитные очки',
    price: 18_500,
    tag: 'новинка',
    tagType: 'new' as const,
    img: 'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992851/11004945_D_45_eys302.avif',
  },
  {
    id: 10002,
    name: 'LILIT 02',
    cat: 'Солнцезащитные очки',
    price: 15_725,
    oldPrice: 18_500,
    tag: '−15%',
    tagType: 'sale' as const,
    img: 'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992850/11004936_D_45_ajjheo.avif',
  },
  {
    id: 10003,
    name: 'MUSEE 02',
    cat: 'Оптические очки',
    price: 22_000,
    tag: 'новинка',
    tagType: 'new' as const,
    img: 'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992851/11004932_D_45_m4jscx.avif',
  },
  {
    id: 10004,
    name: 'HEIZER 03',
    cat: 'Солнцезащитные очки',
    price: 19_900,
    tag: 'новинка',
    tagType: 'new' as const,
    img: 'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992850/11004930_D_45_atvdka.avif',
  },
];

const formatPrice = (price?: number | null) => {
  if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) return 'Цена по запросу';
  return `${price.toLocaleString('ru-RU')} ₽`;
};

function HeartButton() {
  const [filled, setFilled] = useState(false);
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFilled((v) => !v); }}
      className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 backdrop-blur-sm transition hover:bg-white"
      aria-label="В избранное"
    >
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
        <path
          d="M9 15S2 10.5 2 6C2 4 3.8 2.5 6 2.5c1.4 0 2.6.9 3 2.2.4-1.3 1.6-2.2 3-2.2C14.2 2.5 16 4 16 6 16 10.5 9 15 9 15Z"
          stroke={filled ? '#e05555' : '#999'}
          strokeWidth="1.2"
          fill={filled ? '#e05555' : 'none'}
        />
      </svg>
    </button>
  );
}

type Props = {
  /** Товары из БД (если есть). Если пусто — используются статические. */
  items?: HomePromoProduct[];
};

export default function GentleMonsterSpotlight({ items }: Props) {
  const hasDbItems = items && items.length > 0;

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-black/10 bg-[#f5f5f3]">
      {/* ── Заголовок секции ── */}
      <div className="flex items-center justify-center px-4 pt-5 sm:pt-7">
        <h2 className="text-center text-[15px] font-extrabold uppercase tracking-[0.08em] text-black/90 sm:text-xl">
          Gentle Monster — 2025 FALL
        </h2>
      </div>

      {/* ── Баннер ── */}
      <div className="relative mt-3 sm:mt-4">
        <picture>
          <source media="(max-width: 768px)" srcSet={BANNER_MOBILE} />
          <Image
            src={BANNER}
            alt="Gentle Monster 2025 FALL"
            width={1120}
            height={525}
            className="w-full object-cover"
            priority
          />
        </picture>
        <span className="absolute right-3 top-3 text-[9px] font-bold uppercase tracking-[0.06em] text-white sm:text-[11px]">
          Перейти к товарам →
        </span>
      </div>

      {/* ── Карточки товаров ── */}
      <div className="relative z-10 -mt-12 px-3 pb-5 sm:-mt-20 sm:px-5 sm:pb-7">
        {hasDbItems ? (
          /* Карточки из БД — стиль как CmsPromoBlock */
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                href={`/product/${item.id}`}
                className="group relative w-[148px] shrink-0 snap-start overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_6px_20px_rgba(0,0,0,0.07)] transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.12)] sm:w-auto"
              >
                <div className="relative aspect-square bg-[#f4f4f2]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : null}
                </div>
                <div className="space-y-1 p-2.5 sm:p-3">
                  {item.brandName ? (
                    <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/40">
                      {item.brandName}
                    </p>
                  ) : null}
                  <p className="line-clamp-1 text-[11px] font-bold text-black/90 sm:text-[13px]">
                    {item.name}
                  </p>
                  <p className="text-[11px] font-bold text-black/80 sm:text-[13px]">
                    {formatPrice(item.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Статические карточки — для Gentle Monster промо */
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:gap-[19px] sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATIC_PRODUCTS.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                className="group relative w-[148px] shrink-0 snap-start overflow-hidden rounded-none border-none bg-white shadow-none transition hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] sm:w-auto"
              >
                <div className="relative aspect-square overflow-hidden bg-[#f4f4f2]">
                  <Image
                    src={p.img}
                    alt={p.name}
                    fill
                    className="object-cover transition duration-400 group-hover:scale-[1.04]"
                  />
                  {/* Тег */}
                  <span
                    className={`absolute left-1.5 top-1.5 z-10 rounded-sm px-1.5 py-0.5 text-[8px] font-extrabold uppercase leading-none tracking-[0.06em] text-white ${
                      p.tagType === 'sale' ? 'bg-[#555]' : 'bg-[#f80606]'
                    }`}
                  >
                    {p.tag}
                  </span>
                  <HeartButton />
                </div>
                <div className="px-0.5 pb-2.5 pt-2 sm:px-1 sm:pt-2.5">
                  <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/40">
                    {p.cat}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold leading-tight text-black/90 sm:text-[13px]">
                    {p.name}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-black/90 sm:text-[13px]">
                      {formatPrice(p.price)}
                    </span>
                    {p.oldPrice ? (
                      <span className="text-[10px] text-black/30 line-through">
                        {formatPrice(p.oldPrice)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
