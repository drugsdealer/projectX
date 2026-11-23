"use client";

/**
 * Страница розыгрыша. Главное действие одно — перейти к посту в Telegram и участвовать:
 * большая кнопка в первом экране, повтор в шагах и внизу, на телефоне — кнопка, прилипшая к низу экрана.
 * Стиль — как у картинки поста: серая бумага, чернильные брызги, номера Margiela.
 */
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { getOptimizedImageUrl, shouldBypassNextImageOptimization } from "@/lib/media";
import { GIVEAWAY, isGiveawayActive } from "@/lib/promo-giveaway";

export type GiveawayScent = { id: number; name: string; image: string | null; href: string };

const PAPER = "#E8E6E2";
const INK = "#141414";
const TG = "#2AABEE";

function TgIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M21.94 4.3a1.2 1.2 0 0 0-1.62-1.33L2.9 9.7c-1.16.46-1.15 1.1-.2 1.4l4.47 1.4 1.72 5.3c.2.58.1.81.71.81.47 0 .68-.21.94-.47l2.26-2.2 4.7 3.47c.86.48 1.49.23 1.7-.8l2.74-14.3ZM8.6 12.2l9.63-6.07c.48-.29.92-.13.56.19l-8.25 7.44-.32 3.42L8.6 12.2Z" />
    </svg>
  );
}

/** Кнопка «Участвовать в Telegram» — ведёт прямо на пост розыгрыша. */
function TgButton({ big = false, label, className = "" }: { big?: boolean; label: string; className?: string }) {
  return (
    <a
      href={GIVEAWAY.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative inline-flex items-center justify-center gap-3 rounded-full font-black uppercase text-white transition-transform duration-300 hover:-translate-y-0.5 ${
        big ? "px-6 py-5 text-[13px] tracking-[0.1em] sm:px-12 sm:py-6 sm:text-sm sm:tracking-[0.18em]" : "px-6 py-4 text-[12px] tracking-[0.12em]"
      } ${className}`}
      style={{ background: TG, boxShadow: "0 18px 40px -12px rgba(42,171,238,.65)" }}
    >
      {/* пульсирующее кольцо — притягивает взгляд к главной кнопке */}
      {big && <span className="gw-ring pointer-events-none absolute inset-0 rounded-full" aria-hidden="true" />}
      <TgIcon className={big ? "h-6 w-6 shrink-0" : "h-5 w-5 shrink-0"} />
      {label}
      <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
    </a>
  );
}

// Чернильные брызги, как на картинке поста. Координаты фиксированы — одинаково на сервере и в браузере.
const SPLATS = [
  [6, 14, 46], [12, 9, 10], [3, 30, 8], [88, 12, 38], [93, 24, 9], [80, 6, 7], [70, 30, 6],
  [18, 70, 30], [9, 82, 7], [26, 88, 12], [90, 70, 52], [84, 86, 9], [62, 92, 8], [44, 8, 6],
];

function Splatter({ className = "" }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {SPLATS.map(([x, y, r], i) => (
        <g key={i} fill={INK} opacity={0.75}>
          <ellipse cx={x} cy={y} rx={r / 22} ry={r / 14} />
          {[0, 1, 2, 3].map((k) => (
            <circle key={k} cx={x + Math.cos(i * 2 + k * 1.7) * (r / 9)} cy={y + Math.sin(i * 3 + k * 1.3) * (r / 6)} r={0.18 + ((i + k) % 3) * 0.12} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function NumberRow() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-black/35">
      {Array.from({ length: 24 }, (_, i) => (
        <span key={i} className={i === 6 ? "grid h-6 w-6 -my-1 place-items-center rounded-full border border-black/70 text-black" : "leading-4"}>
          {i}
        </span>
      ))}
    </div>
  );
}

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
} as const;

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</section>;
}

export default function GiveawayClient({ scents, initialActive }: { scents: GiveawayScent[]; initialActive: boolean }) {
  // Сервер обновляет страницу раз в 5 минут — в браузере ещё раз сверяемся с часами.
  const [active, setActive] = useState(initialActive);
  useEffect(() => {
    setActive(isGiveawayActive());
    const id = setInterval(() => setActive(isGiveawayActive()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="relative overflow-x-clip pb-24 sm:pb-0" style={{ background: PAPER, color: INK }}>
      {/* ---------- Первый экран ---------- */}
      <div className="relative overflow-hidden">
        <Splatter className="opacity-60" />
        <Section className="relative grid items-center gap-10 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-14 lg:pb-24">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-black/80 bg-white/60 px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.26em] backdrop-blur">
              {active ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: TG }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: TG }} />
                  </span>
                  Идёт в Telegram · итоги {GIVEAWAY.resultsDate}
                </>
              ) : (
                <>Розыгрыш завершён</>
              )}
            </span>

            <h1 className="mt-6 text-[clamp(2.6rem,11.5vw,6.25rem)] font-black uppercase leading-[0.82] tracking-[-0.06em]">
              Розыгрыш
            </h1>
            <p className="mt-5 max-w-xl text-xl font-bold leading-snug tracking-[-0.02em] sm:text-2xl">
              Шапка MM6 Maison Margiela
              <span className="font-light text-black/50"> + </span>
              аромат Replica на выбор
            </p>
            <p className="mt-3 max-w-lg text-[15px] leading-6 text-black/60">
              {active
                ? "Участие бесплатное и занимает минуту — всё происходит в нашем Telegram-канале."
                : `Итоги подведены ${GIVEAWAY.resultsDate} — победителей смотрите в посте розыгрыша. Следующие розыгрыши тоже будут в канале.`}
            </p>

            <div className="mt-9 flex flex-col items-start gap-4">
              <TgButton big label={active ? "Участвовать в Telegram" : "Смотреть итоги в Telegram"} className="w-full sm:w-auto" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-black/45">
                {GIVEAWAY.channel} · 3 шага · бот выберет победителей
              </span>
            </div>
          </motion.div>

          {/* Картинка поста — как плакат, приклеенный скотчем */}
          <motion.a
            href={GIVEAWAY.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Открыть пост розыгрыша в Telegram"
            initial={{ opacity: 0, rotate: 0, y: 30 }}
            animate={{ opacity: 1, rotate: 2.5, y: 0 }}
            whileHover={{ rotate: 0, scale: 1.02 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="relative mx-auto block w-[78%] max-w-[420px] lg:w-full"
          >
            <span className="absolute -top-3 left-1/2 z-10 h-7 w-28 -translate-x-1/2 -rotate-3 bg-white/70 shadow-sm backdrop-blur-sm" aria-hidden="true" />
            <div className="relative overflow-hidden bg-white p-2.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,.45)]">
              <Image src={GIVEAWAY.image} alt="Розыгрыш: шапка MM6 и аромат Maison Margiela Replica" width={640} height={800} priority className="block h-auto w-full" />
            </div>
          </motion.a>
        </Section>
      </div>

      {/* ---------- Призы ---------- */}
      <Section className="pb-20 sm:pb-28">
        <motion.div {...reveal} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-4xl font-black uppercase tracking-[-0.05em] sm:text-5xl">Два приза</h2>
          <NumberRow />
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* 1 место — шапка: кадр из картинки поста */}
          <motion.div {...reveal} className="relative overflow-hidden bg-white">
            <div
              className="aspect-[4/3] w-full bg-no-repeat"
              style={{ backgroundImage: `url(${GIVEAWAY.image})`, backgroundSize: "170%", backgroundPosition: "48% 76%" }}
              role="img"
              aria-label="Шапка MM6 Maison Margiela Numbers"
            />
            <PrizeText prize={GIVEAWAY.prizes[0]} />
          </motion.div>
          {/* 2 место — веер флаконов Replica из каталога */}
          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="relative overflow-hidden bg-white">
            <div className="relative flex aspect-[4/3] w-full items-center justify-center">
              {scents.slice(0, 3).map((s, i) =>
                s.image ? (
                  <div
                    key={s.id}
                    className="absolute h-[70%] w-[36%]"
                    style={{ transform: `translateX(${(i - 1) * 92}%) rotate(${(i - 1) * 6}deg)`, zIndex: i === 1 ? 2 : 1 }}
                  >
                    <Image
                      src={getOptimizedImageUrl(s.image, { width: 400, quality: 80 })}
                      unoptimized={shouldBypassNextImageOptimization(s.image)}
                      alt=""
                      fill
                      sizes="200px"
                      className="object-contain mix-blend-multiply"
                    />
                  </div>
                ) : null
              )}
              <span className="absolute right-5 top-3 text-6xl font-black text-black/80" aria-hidden="true">?</span>
            </div>
            <PrizeText prize={GIVEAWAY.prizes[1]} />
          </motion.div>
        </div>
      </Section>

      {/* ---------- Как участвовать ---------- */}
      <section className="text-white" style={{ background: INK }}>
        <Section className="py-20 sm:py-28">
          <motion.h2 {...reveal} className="text-4xl font-black uppercase tracking-[-0.05em] sm:text-5xl">
            Как участвовать
          </motion.h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-3">
            {GIVEAWAY.steps.map((s, i) => (
              <motion.div key={s} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className="p-6 sm:p-8" style={{ background: INK }}>
                <div className="font-mono text-xs tracking-[0.2em]" style={{ color: TG }}>
                  0{i + 1}
                </div>
                <div className="mt-4 text-lg font-bold leading-snug">{s}</div>
              </motion.div>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <TgButton big label={active ? "Перейти к розыгрышу" : "Открыть пост с итогами"} className="w-full sm:w-auto" />
            <p className="max-w-sm text-sm leading-6 text-white/50">
              Победителей выберет бот среди реальных профилей. Итоги — {GIVEAWAY.resultsDate} в канале {GIVEAWAY.channel}.
            </p>
          </div>
        </Section>
      </section>

      {/* ---------- Ароматы на выбор ---------- */}
      {scents.length > 0 && (
        <Section className="py-20 sm:py-28">
          <motion.div {...reveal} className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-black/45">Приз за 2 место</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] sm:text-4xl">Присмотрите аромат заранее</h2>
            </div>
            <Link href="/brand/maison-margiela" className="font-mono text-[11px] uppercase tracking-[0.2em] text-black/60 underline-offset-4 hover:underline">
              Весь Maison Margiela →
            </Link>
          </motion.div>
          <div className="-mx-5 flex snap-x snap-mandatory scroll-pl-5 gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {scents.map((s) => (
              <Link key={s.id} href={s.href} className="group w-[42%] shrink-0 snap-start sm:w-auto">
                <div className="relative aspect-square overflow-hidden bg-white">
                  {s.image && (
                    <Image
                      src={getOptimizedImageUrl(s.image, { width: 360, quality: 78 })}
                      unoptimized={shouldBypassNextImageOptimization(s.image)}
                      alt={`Maison Margiela Replica ${s.name}`}
                      fill
                      sizes="(max-width: 640px) 42vw, 180px"
                      className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="mt-2 text-sm font-semibold leading-tight">{s.name}</div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- Финальный призыв ---------- */}
      <div className="relative overflow-hidden">
        <Splatter className="opacity-40" />
        <Section className="relative pb-24 pt-4 text-center sm:pb-32">
          <p className="text-3xl font-black uppercase leading-none tracking-[-0.05em] sm:text-5xl">
            {active ? "Минута — и вы в игре" : "Следите за новыми розыгрышами"}
          </p>
          <div className="mt-8 flex justify-center">
            <TgButton big label={active ? "Участвовать в Telegram" : `Подписаться на ${GIVEAWAY.channel}`} />
          </div>
        </Section>
      </div>

      {/* На телефоне кнопка всегда под пальцем */}
      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-black/10 bg-[#E8E6E2]/90 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur sm:hidden">
        <TgButton label={active ? "Участвовать в Telegram" : "Итоги в Telegram"} className="w-full" />
      </div>

      <style jsx global>{`
        .gw-ring {
          box-shadow: 0 0 0 0 rgba(42, 171, 238, 0.55);
          animation: gw-pulse 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        @keyframes gw-pulse {
          0% { box-shadow: 0 0 0 0 rgba(42, 171, 238, 0.55); }
          100% { box-shadow: 0 0 0 18px rgba(42, 171, 238, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gw-ring { animation: none; }
        }
      `}</style>
    </main>
  );
}

function PrizeText({ prize }: { prize: { place: string; name: string; note: string } }) {
  return (
    <div className="flex items-end justify-between gap-4 border-t border-black/10 p-5 sm:p-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-black/45">{prize.place}</div>
        <div className="mt-2 text-xl font-black leading-tight tracking-[-0.02em] sm:text-2xl">{prize.name}</div>
        <div className="mt-1 text-sm text-black/55">{prize.note}</div>
      </div>
    </div>
  );
}
