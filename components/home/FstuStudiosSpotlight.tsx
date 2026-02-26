'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { HomePromoProduct } from '@/components/home/promos/types';

type BowConfig = {
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: number;
};

type Props = {
  items: HomePromoProduct[];
  emptyHint?: string;
  badgeLabel?: string;
  seasonLabel?: string;
  assets?: {
    bowImageUrl?: string;
    logoImageUrl?: string;
    backgroundImageUrl?: string;
  };
};

const BOWS: BowConfig[] = [
  { top: '4%', left: '5%', size: 84, rotate: -26, opacity: 0.28 },
  { top: '10%', left: '26%', size: 70, rotate: 18, opacity: 0.23 },
  { top: '2%', left: '52%', size: 92, rotate: -14, opacity: 0.24 },
  { top: '9%', left: '76%', size: 72, rotate: 24, opacity: 0.26 },
  { top: '31%', left: '8%', size: 66, rotate: 16, opacity: 0.24 },
  { top: '35%', left: '34%', size: 88, rotate: -20, opacity: 0.25 },
  { top: '33%', left: '62%', size: 68, rotate: 15, opacity: 0.22 },
  { top: '28%', left: '84%', size: 86, rotate: -28, opacity: 0.27 },
  { top: '56%', left: '4%', size: 74, rotate: 22, opacity: 0.25 },
  { top: '61%', left: '24%', size: 94, rotate: -16, opacity: 0.26 },
  { top: '57%', left: '50%', size: 70, rotate: 18, opacity: 0.2 },
  { top: '58%', left: '74%', size: 90, rotate: -22, opacity: 0.25 },
];

const formatPrice = (price?: number | null) => {
  if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) return 'Цена по запросу';
  return `от ${price.toLocaleString('ru-RU')} ₽`;
};

export default function FstuStudiosSpotlight({
  items,
  emptyHint = 'Добавьте товары FSTU Studios / ACNE, и блок заполнится автоматически.',
  seasonLabel = "acne SS 26",
  assets,
}: Props) {
  const bowImageUrl = assets?.bowImageUrl || "/img/fstu-bow.svg";
  const logoImageUrl = assets?.logoImageUrl || "/img/acne.png";
  const backgroundImageUrl = assets?.backgroundImageUrl || "";

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-black/20 bg-gradient-to-br from-[#fdf7fa] via-[#f8eef6] to-[#fdf4f8] px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.6),transparent_45%),radial-gradient(circle_at_80%_85%,rgba(255,255,255,0.65),transparent_42%)]" />
      {backgroundImageUrl ? (
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <Image src={backgroundImageUrl} alt="" fill className="object-cover" aria-hidden />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0">
        {BOWS.map((bow, index) => (
          <div
            key={`fstu-bow-${index}`}
            className="absolute"
            style={{
              top: bow.top,
              left: bow.left,
              transform: `rotate(${bow.rotate}deg)`,
              opacity: bow.opacity,
            }}
          >
            <Image
              src={bowImageUrl}
              alt=""
              width={bow.size}
              height={Math.round((bow.size * 104) / 140)}
              className="h-auto w-auto"
              aria-hidden
            />
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto flex max-w-[360px] flex-col items-center text-center">
        <span className="rounded-full border border-black/25 bg-white/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/80 sm:text-[11px]">
        </span>
        <div className="mt-5 w-[180px] sm:w-[230px]">
          <Image
            src={logoImageUrl}
            alt="ACNE"
            width={460}
            height={138}
            className="h-auto w-full object-contain"
          />
        </div>
        <p className="mt-3 text-xs font-semibold tracking-[0.35em] text-black/70 sm:text-sm">
          {seasonLabel}
        </p>
      </div>

      <div className="relative z-10 mt-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/25 bg-white/70 px-4 py-4 text-center text-xs text-black/65">
            {emptyHint}
          </div>
        ) : (
          <div className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-1 sm:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                href={`/product/${item.id}`}
                className="group relative w-[160px] shrink-0 snap-start overflow-hidden rounded-2xl border border-black/15 bg-white/88 shadow-[0_10px_24px_rgba(18,18,18,0.08)] transition hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(18,18,18,0.14)] sm:w-[186px]"
              >
                <div className="relative aspect-[4/5] bg-black/[0.03]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : null}
                </div>
                <div className="space-y-1 p-3">
                  {item.brandName ? <p className="text-[10px] uppercase tracking-[0.16em] text-black/45">{item.brandName}</p> : null}
                  <p className="line-clamp-2 text-xs font-semibold leading-snug text-black/90">{item.name}</p>
                  <p className="text-xs font-bold text-black/80">{formatPrice(item.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
