'use client';

import Image from 'next/image';
import Link from 'next/link';

import type { HomeCmsPromoConfig, HomePromoProduct } from '@/components/home/promos/types';

type Props = {
  promo: HomeCmsPromoConfig;
  items: HomePromoProduct[];
};

const formatPrice = (price?: number | null) => {
  if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) return 'Цена по запросу';
  return `от ${price.toLocaleString('ru-RU')} ₽`;
};

export default function CmsPromoBlock({ promo, items }: Props) {
  const accent = promo.accentColor || '#111111';

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-black/15 bg-[#f8f8f8] p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={promo.backgroundImageUrl}
          alt=""
          fill
          className="object-cover"
          aria-hidden
        />
        <div className="absolute inset-0 bg-white/72 backdrop-blur-[1px]" />
      </div>

      <div className="relative z-10 flex flex-col gap-4 sm:gap-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-black/20 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/70">
            {promo.tag}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-black/45">CMS</span>
        </div>

        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-black/90 sm:text-2xl">{promo.title}</h3>
            <p className="mt-1 max-w-2xl text-xs text-black/60 sm:text-sm">{promo.subtitle}</p>
          </div>
          {promo.logoImageUrl ? (
            <div className="w-[110px] sm:w-[140px]">
              <Image
                src={promo.logoImageUrl}
                alt={promo.name}
                width={420}
                height={140}
                className="h-auto w-full object-contain"
              />
            </div>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/25 bg-white/70 px-4 py-4 text-xs text-black/60">
            Нет подходящих товаров. Добавьте `productIds` или настройте `brandQueries`.
          </div>
        ) : (
          <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.slice(0, promo.maxItems || 8).map((item) => (
              <Link
                key={`${promo.id}-${item.id}`}
                href={`/product/${item.id}`}
                className="group relative w-[162px] shrink-0 snap-start overflow-hidden rounded-2xl border border-black/15 bg-white/90 shadow-[0_10px_24px_rgba(16,16,16,0.08)] transition hover:-translate-y-1 sm:w-[186px]"
              >
                <div
                  className="absolute left-2 top-2 z-10 h-1.5 w-8 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <div className="relative aspect-[4/5] bg-black/[0.03]">
                  {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill className="object-cover" /> : null}
                </div>
                <div className="space-y-1 p-3">
                  {item.brandName ? <p className="text-[10px] uppercase tracking-[0.12em] text-black/45">{item.brandName}</p> : null}
                  <p className="line-clamp-2 text-xs font-semibold text-black/90">{item.name}</p>
                  <p className="text-xs font-bold text-black/75">{formatPrice(item.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
