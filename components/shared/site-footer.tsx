"use client";

import Link from "next/link";
import Image from "next/image";

const FOOTER_LINKS = {
  catalog: [
    { label: "Поиск и категории", href: "/search" },
    { label: "Premium", href: "/premium" },
    { label: "Новинки", href: "/search?tag=new" },
    { label: "Sale", href: "/search?tag=sale" },
  ],
  help: [
    { label: "Доставка", href: "/shipping" },
    { label: "Возврат и обмен", href: "/returns" },
    { label: "Оплата", href: "/payment" },
    { label: "Таблица размеров", href: "/size-guide" },
  ],
  legal: [
    { label: "Публичная оферта", href: "/offer" },
    { label: "Политика конфиденциальности", href: "/privacy" },
    { label: "Персональные данные", href: "/personal-data" },
    { label: "Условия использования", href: "/terms" },
  ],
};

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://instagram.com/stagestore",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm5 3.3a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4zm0 2a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm4.9-.9a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    label: "Telegram",
    href: "https://t.me/stagestore",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M20.7 4.2a1.1 1.1 0 0 0-1.1-.2L3.6 9.7c-.9.3-.9 1.6.1 1.9l4.2 1.3 1.6 4.6c.2.7 1.1.9 1.6.3l2.4-2.7 4.5 3.3c.6.4 1.4.1 1.6-.6l2.1-12.7c.1-.6-.4-1.2-1-1.1zm-2 2.3-1.7 9.9-3.8-2.8a.9.9 0 0 0-1.2.2l-1.7 2-.9-2.7a1 1 0 0 0-.6-.6l-2.6-.8 11.5-4.2-.8 3.4z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

const PAYMENT_METHODS = [
  {
    label: "Visa",
    src: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1768923278/Visa_2021.svg_gtkopy.png",
  },
  {
    label: "Mastercard",
    src: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1768923314/Mastercard-logo.svg_bf68dq.png",
  },
  {
    label: "МИР",
    src: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1768923362/Mir-logo.SVG.svg_fwqq8b.png",
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-[#0b0b0b] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute right-[-120px] bottom-[-120px] h-72 w-72 rounded-full bg-blue-500/10 blur-[90px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/40" />
        </div>

        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-8">
            <div>
              <div className="flex items-center gap-3">
                <Image src="/img/IMG_0363.PNG" alt="Stage Store" width={64} height={56} className="object-contain" />
                <div>
                  <div className="text-lg font-extrabold tracking-tight">STAGE STORE</div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/60">Concept Store</div>
                </div>
              </div>
              <p className="mt-4 text-sm text-white/70 leading-relaxed">
                Оригинальные кроссовки, одежда и аксессуары. Редкие размеры, аккуратная проверка и честная доставка.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {PAYMENT_METHODS.map((item) => (
                  <div
                    key={item.label}
                    className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-white/15 bg-white/5"
                    aria-label={item.label}
                    title={item.label}
                  >
                    <Image src={item.src} alt={item.label} width={64} height={24} className="h-5 w-auto object-contain" />
                  </div>
                ))}
                <span className="inline-flex items-center h-9 px-3 rounded-xl border border-white/15 bg-white/5 text-[11px] text-white/70">
                  Поддержка 10:00–21:00
                </span>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold">Каталог</div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                {FOOTER_LINKS.catalog.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:text-white transition">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-sm font-semibold">Покупателям</div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                {FOOTER_LINKS.help.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:text-white transition">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-sm font-semibold">Контакты и право</div>
              <div className="mt-3 space-y-2 text-sm text-white/70">
                <div>Москва, ул. Тверская, 12</div>
                <a href="mailto:info@stagestore.ru" className="hover:text-white transition">
                  info@stagestore.ru
                </a>
                <a href="tel:+74951234567" className="hover:text-white transition">
                  +7 (495) 123-45-67
                </a>
              </div>
              <div className="mt-4 text-xs text-white/50">
                ООО «Stage Store». Реквизиты и условия — в документах ниже.
              </div>
              <div className="mt-4">
                <div className="text-xs font-semibold text-white/70">Соцсети</div>
                <div className="mt-2 flex items-center gap-2">
                  {SOCIAL_LINKS.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={item.label}
                      className="h-10 w-10 rounded-full border border-white/15 bg-white/5 inline-flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition"
                    >
                      {item.icon}
                    </a>
                  ))}
                </div>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                {FOOTER_LINKS.legal.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:text-white transition">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[12px] text-white/60">
            <div className="flex flex-wrap items-center gap-2">
              <span>© {year} Stage Store. Все права защищены.</span>
              <span className="text-white/35">•</span>
              <span className="text-white/35">created by: crymont x proxyesssss</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/privacy" className="hover:text-white transition">
                Политика конфиденциальности
              </Link>
              <Link href="/offer" className="hover:text-white transition">
                Оферта
              </Link>
              <Link href="/contacts" className="hover:text-white transition">
                Контакты
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
