import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const metadata: Metadata = {
  title: "О нас",
  description: "Stage Store — интернет-магазин оригинальной брендовой одежды, обуви и аксессуаров. Доставка по Москве и России.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/about`,
    title: "О нас — Stage Store",
    description: "Оригинальная брендовая одежда, обувь и аксессуары с доставкой по России.",
  },
  robots: { index: true, follow: true },
};

const values = [
  {
    title: "100% оригинал",
    desc: "Работаем только с авторизованными поставщиками. Каждый товар проходит проверку подлинности перед отправкой.",
  },
  {
    title: "Честные цены",
    desc: "Без скрытых наценок. Цена при оформлении — финальная. Регулярные акции для наших покупателей.",
  },
  {
    title: "Быстрая доставка",
    desc: "Доставляем по Москве за 1–2 дня, по России за 3–14 дней. Отслеживание на каждом этапе.",
  },
  {
    title: "Простой возврат",
    desc: "14 дней на возврат без лишних вопросов. Если что-то не так — решим быстро и без бюрократии.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        <div className="mb-2">
          <Link href="/" className="text-sm text-black/40 hover:text-black transition">
            ← Stage Store
          </Link>
        </div>

        <div className="mt-6 pb-8 border-b border-black/10">
          <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white mb-4">
            О нас
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Stage Store</h1>
          <p className="mt-4 text-base text-black/65 leading-relaxed">
            Мы — концепт-стор оригинальной брендовой одежды, обуви и аксессуаров. Собираем лучшее из мира стритвера,
            люкса и современной культуры в одном месте.
          </p>
        </div>

        <div className="mt-8">
          <p className="text-sm text-black/65 leading-relaxed">
            Stage Store появился из любви к брендовым вещам и желания сделать их доступными для всех в России.
            Мы тщательно отбираем каждую позицию в каталоге — только актуальные релизы, культовые силуэты и редкие
            коллаборации.
          </p>
          <p className="mt-4 text-sm text-black/65 leading-relaxed">
            Наша команда следит за мировыми дропами, работает с проверенными поставщиками и гарантирует подлинность
            каждого товара. Мы верим, что хорошие вещи должны быть доступны без переплат и рисков.
          </p>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {values.map((v) => (
            <div key={v.title} className="rounded-2xl border border-black/10 p-5">
              <div className="font-bold">{v.title}</div>
              <div className="mt-2 text-sm text-black/60 leading-relaxed">{v.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-black/10">
          <div className="text-sm font-semibold text-black/50 uppercase tracking-wider mb-4">Узнать больше</div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Каталог товаров", href: "/search" },
              { label: "Premium коллекция", href: "/premium" },
              { label: "Доставка", href: "/shipping" },
              { label: "Контакты", href: "/contacts" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center px-4 py-2 rounded-full border border-black/15 text-sm font-medium text-black/70 hover:border-black/40 hover:text-black transition"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 text-xs text-black/35">
          © {new Date().getFullYear()} Stage Store. Все права защищены.
        </div>
      </div>
    </main>
  );
}
