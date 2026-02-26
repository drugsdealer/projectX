'use client';

import Image from 'next/image';
import Link from 'next/link';

type RecommendationItem = {
  id: number;
  name: string;
  price: number | null;
  imageUrl: string | null;
  brandName?: string | null;
  brandLogo?: string | null;
};

type TopBrandItem = {
  brandId: number;
  brandName: string;
  weightedScore: number;
  slug?: string | null;
  logoUrl?: string | null;
};

type Props = {
  personalized: RecommendationItem[];
  bestsellers: RecommendationItem[];
  topBrands: TopBrandItem[];
  loading: boolean;
  onRefresh: () => void;
};

function ProductMiniCard({ item }: { item: RecommendationItem }) {
  return (
    <Link
      href={`/product/${item.id}`}
      className="group overflow-hidden rounded-2xl border border-black/10 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.08)]"
    >
      <div className="relative aspect-[4/5] bg-black/[0.03]">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} fill className="object-cover transition group-hover:scale-[1.03]" />
        ) : null}
      </div>
      <div className="p-3">
        {item.brandName ? <div className="text-[11px] text-black/55">{item.brandName}</div> : null}
        <div className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{item.name}</div>
        <div className="mt-2 text-sm font-bold">
          {typeof item.price === 'number' && item.price > 0 ? `от ${item.price.toLocaleString('ru-RU')} ₽` : 'Цена по запросу'}
        </div>
      </div>
    </Link>
  );
}

export default function PersonalizedHomeSections({
  personalized,
  bestsellers,
  topBrands,
  loading,
  onRefresh,
}: Props) {
  return (
    <section className="space-y-6 rounded-3xl border border-black/10 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Персональные подборки</h2>
          <p className="mt-1 text-xs text-black/50">На основе просмотров, добавлений в корзину, покупок, поиска и интереса к брендам.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-4 text-xs font-semibold transition hover:bg-black hover:text-white"
        >
          Обновить рекомендации
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-black/10 bg-black/[0.04]" />
            ))
          : personalized.slice(0, 8).map((item) => <ProductMiniCard key={`p-${item.id}`} item={item} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">Любимые бренды</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {topBrands.length ? (
              topBrands.slice(0, 8).map((brand) => (
                <Link
                  key={brand.brandId}
                  href={brand.slug ? `/brand/${encodeURIComponent(brand.slug)}` : `/search?q=${encodeURIComponent(brand.brandName)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black/80 transition hover:border-black/30"
                >
                  {brand.logoUrl ? (
                    <span className="relative block h-4 w-4 overflow-hidden rounded-full bg-white">
                      <Image src={brand.logoUrl} alt={brand.brandName} fill className="object-contain" />
                    </span>
                  ) : null}
                  {brand.brandName}
                </Link>
              ))
            ) : (
              <div className="text-xs text-black/55">Собираем сигнал по брендам. Добавь несколько просмотров и поисков.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-black text-white p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Промо</div>
          <div className="mt-2 text-lg font-extrabold leading-tight">Акции и капсулы недели</div>
          <p className="mt-1 text-xs text-white/70">Собрали подборки, чтобы главная сразу показывала актуальные предложения.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/search?tag=sale" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black">Sale до -30%</Link>
            <Link href="/premium" className="rounded-full border border-white/35 px-3 py-1.5 text-xs font-semibold text-white">Premium</Link>
            <Link href="/search?tag=new" className="rounded-full border border-white/35 px-3 py-1.5 text-xs font-semibold text-white">Новинки</Link>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold">Бестселлеры по общей статистике</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {bestsellers.slice(0, 10).map((item) => (
            <ProductMiniCard key={`b-${item.id}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
