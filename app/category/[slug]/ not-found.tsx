

import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NotFound({ params }: { params: { slug: string } }) {
  const raw = params?.slug ?? '';
  const q = decodeURIComponent(raw).replace(/[-_]+/g, ' ').trim();

  return (
    <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-16">
      <div className="relative overflow-hidden rounded-[32px] border border-black/10 bg-white shadow-[0_30px_120px_rgba(0,0,0,0.10)]">
        {/* ambient background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(0,0,0,0.06),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(0,0,0,0.05),transparent_58%),linear-gradient(to_bottom,rgba(255,255,255,1),rgba(245,245,245,1))]" />
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] [background-image:radial-gradient(rgba(0,0,0,1)_1px,transparent_1px)] [background-size:14px_14px]" />

        <div className="relative p-8 sm:p-12">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-black/60">
                404 · КАТЕГОРИЯ НЕ НАЙДЕНА
              </div>

              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
                Такой категории пока нет
              </h1>

              <p className="mt-3 text-sm sm:text-base text-black/60 max-w-[60ch]">
                Мы не нашли товары по этому запросу. Возможно, ты ошибся в названии или эта категория временно скрыта.
              </p>

              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-black/45">Твой запрос</div>
                <div className="mt-2 inline-flex max-w-full items-center rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
                  <span className="truncate text-base sm:text-lg font-extrabold tracking-tight">{q || raw}</span>
                </div>
              </div>
            </div>

            <div className="hidden sm:block text-right">
              <div className="text-[72px] font-extrabold tracking-tight text-black/10 leading-none">404</div>
              <div className="mt-2 text-xs text-black/45">Stage Store</div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/search"
              className="h-12 inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 text-sm font-semibold text-black/70 hover:border-black/20 hover:bg-black/[0.02] transition"
            >
              Перейти к поиску
            </Link>

            <Link
              href="/"
              className="h-12 inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 text-sm font-semibold text-black/70 hover:border-black/20 hover:bg-black/[0.02] transition"
            >
              На главную
            </Link>

            <Link
              href={`/search?q=${encodeURIComponent(q || raw)}`}
              className="h-12 inline-flex items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white hover:bg-black/90 transition"
            >
              Искать “{q || raw}”
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-black/10 bg-white/70 p-5">
              <div className="text-xs font-semibold text-black/60">Подсказка</div>
              <div className="mt-2 text-sm text-black/55">Проверь написание или попробуй более общее слово.</div>
            </div>
            <div className="rounded-3xl border border-black/10 bg-white/70 p-5">
              <div className="text-xs font-semibold text-black/60">Популярное</div>
              <div className="mt-2 text-sm text-black/55">Открой поиск — там есть живые подборки и промо.</div>
            </div>
            <div className="rounded-3xl border border-black/10 bg-white/70 p-5">
              <div className="text-xs font-semibold text-black/60">Категории</div>
              <div className="mt-2 text-sm text-black/55">Список категорий формируется из базы — только актуальные.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}