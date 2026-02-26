'use client';

import Image from 'next/image';
import Link from 'next/link';

type ProductItem = {
  id: number;
  name: string;
  price?: number | null;
  imageUrl?: string | null;
  brandName?: string | null;
};

type Props = {
  title: string;
  subtitle?: string;
  items: ProductItem[];
  ctaLabel?: string;
  onCtaClick?: () => void;
  emptyHint?: string;
  variant?: 'bestseller' | 'brand' | 'editorial' | 'personal';
  eyebrow?: string;
};

type Theme = {
  shell: string;
  ring: string;
  chip: string;
  chipText: string;
  accent: string;
  introBg: string;
  introRing: string;
  cardRing: string;
  cardBg: string;
  badgeBg: string;
  badgeText: string;
  motif: string;
};

const THEMES: Record<string, Theme> = {
  bestseller: {
    shell: 'from-[#eef4ff] via-[#f6f8ff] to-[#edf2ff]',
    ring: 'border-[#1e3a8a]/20',
    chip: 'bg-[#1e3a8a]/12',
    chipText: 'text-[#1e3a8a]',
    accent: 'bg-[#1e3a8a]',
    introBg: 'from-[#f8fbff] to-[#e9f0ff]',
    introRing: 'border-[#1e3a8a]/22',
    cardRing: 'border-[#1e3a8a]/20',
    cardBg: 'from-[#fdfefe] to-[#eef3ff]',
    badgeBg: 'bg-[#1e3a8a]',
    badgeText: 'text-white',
    motif: '[background-image:linear-gradient(135deg,rgba(30,58,138,0.08)_12%,transparent_12%,transparent_50%,rgba(30,58,138,0.08)_50%,rgba(30,58,138,0.08)_62%,transparent_62%,transparent_100%)] [background-size:22px_22px]',
  },
  brand: {
    shell: 'from-[#ebfbf6] via-[#f4fdf9] to-[#ebfbf6]',
    ring: 'border-[#0f766e]/20',
    chip: 'bg-[#0f766e]/12',
    chipText: 'text-[#0f766e]',
    accent: 'bg-[#0f766e]',
    introBg: 'from-[#f4fffb] to-[#e7faf4]',
    introRing: 'border-[#0f766e]/20',
    cardRing: 'border-[#0f766e]/18',
    cardBg: 'from-[#ffffff] to-[#edfbf6]',
    badgeBg: 'bg-[#0f766e]',
    badgeText: 'text-white',
    motif: '[background-image:radial-gradient(rgba(15,118,110,0.14)_1.2px,transparent_1.2px)] [background-size:15px_15px]',
  },
  editorial: {
    shell: 'from-[#fff5ec] via-[#fff9f3] to-[#fff2e3]',
    ring: 'border-[#9a3412]/20',
    chip: 'bg-[#9a3412]/10',
    chipText: 'text-[#9a3412]',
    accent: 'bg-[#9a3412]',
    introBg: 'from-[#fffdf8] to-[#fff1e3]',
    introRing: 'border-[#9a3412]/18',
    cardRing: 'border-[#9a3412]/17',
    cardBg: 'from-[#ffffff] to-[#fff4e8]',
    badgeBg: 'bg-[#9a3412]',
    badgeText: 'text-white',
    motif: '[background-image:linear-gradient(90deg,rgba(154,52,18,0.09)_1px,transparent_1px),linear-gradient(180deg,rgba(154,52,18,0.09)_1px,transparent_1px)] [background-size:18px_18px]',
  },
  personal: {
    shell: 'from-[#eef2f7] via-[#f8f9fc] to-[#edf1f7]',
    ring: 'border-[#1f2937]/20',
    chip: 'bg-[#1f2937]/10',
    chipText: 'text-[#1f2937]',
    accent: 'bg-[#1f2937]',
    introBg: 'from-[#f9fbff] to-[#edf2fb]',
    introRing: 'border-[#1f2937]/20',
    cardRing: 'border-[#1f2937]/18',
    cardBg: 'from-[#ffffff] to-[#eff4fe]',
    badgeBg: 'bg-[#1f2937]',
    badgeText: 'text-white',
    motif: '[background-image:radial-gradient(rgba(31,41,55,0.13)_1px,transparent_1px)] [background-size:14px_14px]',
  },
};

const formatPrice = (price?: number | null) => {
  if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) return 'Цена по запросу';
  return `от ${price.toLocaleString('ru-RU')} ₽`;
};

export default function HomeFeedInsert({
  title,
  subtitle,
  items,
  ctaLabel,
  onCtaClick,
  emptyHint,
  variant = 'personal',
  eyebrow = 'Подборка',
}: Props) {
  const theme = THEMES[variant] || THEMES.personal;

  return (
    <section className={`relative overflow-hidden rounded-[30px] border bg-gradient-to-br p-4 sm:p-5 ${theme.shell} ${theme.ring}`}>
      <div className={`pointer-events-none absolute inset-0 opacity-[0.28] ${theme.motif}`} />
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-white/35 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/4 h-44 w-44 rounded-full bg-white/40 blur-2xl" />

      {items.length === 0 ? (
        <div className="relative rounded-2xl border border-dashed border-black/20 bg-white/75 px-4 py-5 text-xs text-black/60">
          {emptyHint || 'Пока недостаточно данных для этого блока.'}
        </div>
      ) : (
        <div className="relative grid gap-4 sm:gap-5 lg:grid-cols-[260px_1fr]">
          <div className={`rounded-3xl border bg-gradient-to-b p-4 sm:p-5 ${theme.introBg} ${theme.introRing}`}>
            <div className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${theme.chip} ${theme.chipText}`}>
              {eyebrow}
            </div>
            <h4 className="mt-3 text-[17px] font-extrabold tracking-tight text-black/90">{title}</h4>
            {subtitle ? <p className="mt-2 text-xs leading-relaxed text-black/65">{subtitle}</p> : null}

            <div className="mt-4 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${theme.accent}`} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/55">
                {items.length} карточек в ленте
              </span>
            </div>

            {ctaLabel && onCtaClick ? (
              <button
                type="button"
                onClick={onCtaClick}
                className="mt-4 inline-flex rounded-full border border-black/15 bg-white px-3.5 py-2 text-[11px] font-semibold text-black/75 transition hover:bg-black hover:text-white"
              >
                {ctaLabel}
              </button>
            ) : null}
          </div>

          <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 sm:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.slice(0, 8).map((item, index) => (
              <Link
                key={item.id}
                href={`/product/${item.id}`}
                className={`group relative w-[168px] shrink-0 snap-start overflow-hidden rounded-2xl border bg-gradient-to-b transition hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(0,0,0,0.12)] sm:w-[190px] ${theme.cardRing} ${theme.cardBg} ${index % 2 ? 'sm:mt-3' : ''}`}
              >
                <div className={`absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${theme.badgeBg} ${theme.badgeText}`}>
                  {variant === 'bestseller' ? `#${index + 1}` : 'pick'}
                </div>

                <div className="relative aspect-[4/5] bg-white">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-contain p-2 sm:p-3 transition duration-300 group-hover:scale-[1.01]"
                    />
                  ) : null}
                </div>

                <div className="p-2.5">
                  {item.brandName ? <div className="text-[10px] uppercase tracking-[0.12em] text-black/50">{item.brandName}</div> : null}
                  <div className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-black/90">{item.name}</div>
                  <div className="mt-1 text-xs font-extrabold text-black/80">{formatPrice(item.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
