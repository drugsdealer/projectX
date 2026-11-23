import type { Metadata } from "next";
import Image from "next/image";
import { GIVEAWAY, isGiveawayActive } from "@/lib/promo-giveaway";

/**
 * Короткая посадочная страница розыгрыша для рекламы в Яндекс Директе: один экран,
 * одно действие — перейти к посту в Telegram. Подробная версия — /giveaway.
 */
export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";
const TITLE = "Розыгрыш шапки MM6 и аромата Maison Margiela Replica";
const DESCRIPTION = `Участвуйте в розыгрыше Stage Store в Telegram: шапка MM6 Maison Margiela и аромат Replica на выбор. Итоги ${GIVEAWAY.resultsDate}.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/rozygrysh` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/rozygrysh`,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: `${SITE_URL}/promo/giveaway/og.jpg`, width: 1200, height: 630, alt: "Розыгрыш Stage Store", type: "image/jpeg" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${SITE_URL}/promo/giveaway/og.jpg`] },
  // Рекламная копия /giveaway — в поиск не отдаём, чтобы не было дублей.
  robots: { index: false, follow: true },
};

function TgIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M21.94 4.3a1.2 1.2 0 0 0-1.62-1.33L2.9 9.7c-1.16.46-1.15 1.1-.2 1.4l4.47 1.4 1.72 5.3c.2.58.1.81.71.81.47 0 .68-.21.94-.47l2.26-2.2 4.7 3.47c.86.48 1.49.23 1.7-.8l2.74-14.3ZM8.6 12.2l9.63-6.07c.48-.29.92-.13.56.19l-8.25 7.44-.32 3.42L8.6 12.2Z" />
    </svg>
  );
}

export default function RozygryshPage() {
  const active = isGiveawayActive();

  return (
    <main className="min-h-[calc(100svh-64px)] bg-[#E8E6E2] text-[#141414]">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 px-5 py-8 sm:px-8 sm:py-14 md:grid-cols-[minmax(0,1fr)_380px] md:gap-14">
        <div className="order-2 md:order-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-black/80 bg-white/60 px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.24em]">
            <span className="h-2 w-2 rounded-full bg-[#2AABEE]" />
            {active ? `Telegram · итоги ${GIVEAWAY.resultsDate}` : "Розыгрыш завершён"}
          </span>

          <h1 className="mt-5 text-[clamp(2.6rem,11vw,5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">
            Розыгрыш
          </h1>

          <ul className="mt-6 space-y-2.5">
            {GIVEAWAY.prizes.map((p) => (
              <li key={p.place} className="flex items-baseline gap-3">
                <span className="w-[74px] shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-black/45">{p.place}</span>
                <span className="text-lg font-bold leading-snug">
                  {p.name} <span className="font-normal text-black/50">· {p.note}</span>
                </span>
              </li>
            ))}
          </ul>

          <a
            href={GIVEAWAY.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-[#2AABEE] px-6 py-5 text-[13px] font-black uppercase tracking-[0.12em] text-white shadow-[0_18px_40px_-12px_rgba(42,171,238,.7)] transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-12 sm:text-sm"
          >
            {active && <span className="rz-ring pointer-events-none absolute inset-0 rounded-full" aria-hidden="true" />}
            <TgIcon className="relative h-6 w-6 shrink-0" />
            <span className="relative">{active ? "Участвовать в Telegram" : "Итоги в Telegram"}</span>
            <span className="relative transition-transform group-hover:translate-x-1">→</span>
          </a>

          {active ? (
            <ol className="mt-7 grid gap-2 text-[15px] leading-6 text-black/70 sm:grid-cols-3 sm:gap-4">
              {GIVEAWAY.steps.map((s, i) => (
                <li key={s} className="flex gap-2.5">
                  <span className="font-mono text-xs leading-6 text-[#1b8fd0]">0{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-6 text-[15px] leading-6 text-black/60">
              Итоги подведены — победители в посте розыгрыша. Новые розыгрыши — в канале {GIVEAWAY.channel}.
            </p>
          )}
          <p className="mt-5 text-xs text-black/45">Участие бесплатное. Победителей выберет бот среди реальных профилей.</p>
        </div>

        <a
          href={GIVEAWAY.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Открыть пост розыгрыша в Telegram"
          className="order-1 mx-auto block w-[54%] max-w-[380px] rotate-2 bg-white p-2 shadow-[0_24px_50px_-18px_rgba(0,0,0,.45)] transition-transform hover:rotate-0 md:order-2 md:w-full"
        >
          <Image src={GIVEAWAY.image} alt="Розыгрыш: шапка MM6 и аромат Maison Margiela Replica" width={640} height={800} priority className="block h-auto w-full" />
        </a>
      </div>
      <style>{`
        .rz-ring { animation: rz-pulse 2.2s cubic-bezier(.22,1,.36,1) infinite; }
        @keyframes rz-pulse {
          0% { box-shadow: 0 0 0 0 rgba(42,171,238,.55); }
          100% { box-shadow: 0 0 0 16px rgba(42,171,238,0); }
        }
        @media (prefers-reduced-motion: reduce) { .rz-ring { animation: none; } }
      `}</style>
    </main>
  );
}
