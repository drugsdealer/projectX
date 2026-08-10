import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY } from "@/lib/company";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Контакты Stage Store — как с нами связаться по вопросам заказов, доставки и сотрудничества.",
  alternates: { canonical: `${SITE_URL}/contacts` },
  robots: { index: true, follow: true },
};

const contacts = [
  {
    label: "Email",
    value: COMPANY.email,
    href: `mailto:${COMPANY.email}`,
    desc: "Общие вопросы, возвраты, сотрудничество",
  },
  {
    label: "Telegram",
    value: "@stagestore",
    href: "https://t.me/stagestore",
    desc: "Быстрый ответ — обычно в течение часа",
  },
];

const faq = [
  {
    q: "Как проверить статус заказа?",
    a: "Войдите в личный кабинет → раздел «Мои заказы». Там отображается актуальный статус и номер отслеживания.",
  },
  {
    q: "Как оформить возврат?",
    a: "Напишите на storestage@yandex.ru с темой «Возврат заказа #XXXXX». Подробные условия — на странице Возврат и обмен.",
    link: { label: "Возврат и обмен →", href: "/returns" },
  },
  {
    q: "Какие способы оплаты доступны?",
    a: "Банковская карта (Visa, Mastercard, МИР) и СБП. Оплата обрабатывается через ЮKassa.",
  },
  {
    q: "Вы продаёте оригинальные товары?",
    a: "Да, 100% оригинал. Мы работаем только с авторизованными поставщиками и гарантируем подлинность каждого товара.",
  },
];

export default function ContactsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        <div className="mb-2">
          <Link href="/" className="text-sm text-black/40 hover:text-black transition">
            ← Stage Store
          </Link>
        </div>

        <div className="mt-6 pb-8 border-b border-black/10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Контакты</h1>
          <p className="mt-3 text-base text-black/60">
            Мы работаем каждый день с 10:00 до 21:00 (МСК). Обычно отвечаем в течение 1–2 часов.
          </p>
        </div>

        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          {contacts.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel={c.href.startsWith("http") ? "noreferrer" : undefined}
              className="block rounded-2xl border border-black/10 p-5 hover:border-black/30 hover:shadow-sm transition group"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-black/40">{c.label}</div>
              <div className="mt-1 text-lg font-bold group-hover:underline">{c.value}</div>
              <div className="mt-1 text-sm text-black/50">{c.desc}</div>
            </a>
          ))}
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Часто задаваемые вопросы</h2>
          <div className="mt-4 space-y-5">
            {faq.map((item, i) => (
              <div key={i} className="border-b border-black/8 pb-5">
                <div className="font-semibold">{item.q}</div>
                <div className="mt-2 text-sm text-black/65 leading-relaxed">{item.a}</div>
                {item.link && (
                  <Link href={item.link.href} className="mt-2 inline-block text-sm font-medium hover:underline">
                    {item.link.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-black/10">
          <div className="text-sm font-semibold text-black/50 uppercase tracking-wider mb-4">Полезные страницы</div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Доставка", href: "/shipping" },
              { label: "Возврат и обмен", href: "/returns" },
              { label: "Публичная оферта", href: "/offer" },
              { label: "Политика конфиденциальности", href: "/privacy" },
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

        {/* Реквизиты продавца */}
        <div className="mt-12 pt-8 border-t border-black/10">
          <div className="text-sm font-semibold text-black/50 uppercase tracking-wider mb-4">Реквизиты</div>
          <dl className="rounded-2xl border border-black/10 bg-black/[0.02] p-5 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-black/45">Продавец</dt>
              <dd className="font-medium text-black/80">{COMPANY.legalName}</dd>
            </div>
            <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-black/45">ИНН</dt>
              <dd className="font-medium text-black/80 tabular-nums">{COMPANY.inn}</dd>
            </div>
            <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-black/45">ОГРНИП</dt>
              <dd className="font-medium text-black/80 tabular-nums">{COMPANY.ogrnip}</dd>
            </div>
            <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-black/45">Email</dt>
              <dd className="font-medium">
                <a href={`mailto:${COMPANY.email}`} className="text-black/80 underline underline-offset-2 hover:text-black">
                  {COMPANY.email}
                </a>
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 text-xs text-black/35">
          © {new Date().getFullYear()} Stage Store. Все права защищены.
        </div>
      </div>
    </main>
  );
}
