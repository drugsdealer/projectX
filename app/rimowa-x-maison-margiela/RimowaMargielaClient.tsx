"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { toProxiedImageUrl, toProxiedVideoUrl } from "@/lib/media";
import { COMPANY } from "@/lib/company";
import PdConsentCheckbox from "@/components/legal/PdConsentCheckbox";

// Релиз: 19 ноября 2026, по Москве.
const RELEASE_AT = new Date("2026-11-19T00:00:00+03:00").getTime();

const FILM = "https://ik.imagekit.io/qowmy92ny/RIMOWAXMAISONMARGIELACOLLABORATION_DESK.mp4";
const FILM_MOBILE = "https://ik.imagekit.io/qowmy92ny/tr:w-720,q-60/RIMOWAXMAISONMARGIELACOLLABORATION_DESK.mp4";

// Кадры из фильма кампании — ImageKit отдаёт их как картинки, через наш домен.
const still = (second: number, width = 1600) =>
  toProxiedImageUrl(`${FILM}/ik-thumbnail.jpg?tr=so-${second},w-${width},q-82`);

const STILL_SET = still(17, 1920);
const STILL_ROOM = still(9, 1920);
const STILL_CABIN = still(13);
const STILL_BAG = still(15);

// Палитра бьянкетто: белила поверх бумаги, графит вместо чёрного.
const PAPER = "#f2efe9";
const INK = "#191917";

const GROOVES = {
  backgroundImage:
    "repeating-linear-gradient(90deg, transparent 0 26px, rgba(25,25,23,0.035) 26px 27px, rgba(255,255,255,0.7) 27px 28px)",
};

const OBJECTS = [
  {
    n: "01",
    house: "RIMOWA",
    name: "Classic Cabin",
    image: STILL_CABIN,
    alt: "Силуэт чемодана RIMOWA Classic Cabin на выбеленной стене",
    lines: [
      "Культовые рёбра RIMOWA — когда-то их подсмотрели у фюзеляжа самолёта",
      "Корпус вручную покрыт белилами бьянкетто: со временем они трескаются и стираются",
      "Белый интерьер, швы и стыки наружу — чемодан будто вывернут наизнанку",
      "На фирменной табличке — четыре белых стежка, подпись Maison Margiela",
    ],
  },
  {
    n: "02",
    house: "Maison Margiela",
    name: "5AC XL",
    image: STILL_BAG,
    alt: "Силуэт сумки Maison Margiela 5AC XL на выбеленном диване",
    lines: [
      "Дорожная версия 5AC из кожи с рельефными рёбрами — в ритме корпуса RIMOWA",
      "Подкладка словно вытянута наружу через горловину",
      "Съёмные кожаные петли: сумка садится на телескопическую ручку Classic Cabin",
      "Та же ручная роспись бьянкетто — на коже она стареет по-своему",
    ],
  },
] as const;

const CHOICES = ["Комплект", "Чемодан Classic Cabin", "Сумка 5AC XL"] as const;

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function useCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, RELEASE_AT - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

// Белая бирка Margiela: пустой ярлык на четырёх стежках.
function Label({ children, className = "relative" }: { children: ReactNode; className?: string }) {
  const stitch = "absolute h-[7px] w-[1.5px] rounded-full bg-black/20";
  return (
    <div className={`bg-white px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] ${className}`}>
      <span className={`${stitch} left-2 top-1.5`} />
      <span className={`${stitch} right-2 top-1.5`} />
      <span className={`${stitch} bottom-1.5 left-2`} />
      <span className={`${stitch} bottom-1.5 right-2`} />
      {children}
    </div>
  );
}

// Ряд номеров линий Maison Margiela; 11 — аксессуары и сумки.
function NumberRow({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-x-2.5 gap-y-1 font-mono text-[11px] ${dark ? "text-white/35" : "text-black/35"}`}>
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className={
            i === 11
              ? `grid h-6 w-6 -my-1 place-items-center rounded-full border ${dark ? "border-white/70 text-white" : "border-black/70 text-black"}`
              : "leading-4"
          }
        >
          {i}
        </span>
      ))}
    </div>
  );
}

function Countdown({ dark = true }: { dark?: boolean }) {
  const left = useCountdown();
  if (left === 0) {
    return (
      <div className={`font-mono text-xs uppercase tracking-[0.3em] ${dark ? "text-white/80" : "text-black/70"}`}>
        Коллекция вышла · 19.11.2026
      </div>
    );
  }
  const parts =
    left === null
      ? ["––", "––", "––", "––"]
      : [
          Math.floor(left / 86_400_000),
          Math.floor(left / 3_600_000) % 24,
          Math.floor(left / 60_000) % 60,
          Math.floor(left / 1000) % 60,
        ].map((v) => String(v).padStart(2, "0"));
  const units = ["дн", "ч", "мин", "сек"];
  return (
    <div className="flex items-end gap-4 sm:gap-6">
      {parts.map((v, i) => (
        <div key={units[i]} className="text-center">
          <div className={`font-mono text-2xl font-light tabular-nums sm:text-4xl ${dark ? "text-white" : "text-black"}`}>
            {v}
          </div>
          <div className={`mt-1 font-mono text-[10px] uppercase tracking-[0.28em] ${dark ? "text-white/45" : "text-black/40"}`}>
            {units[i]}
          </div>
        </div>
      ))}
    </div>
  );
}

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
} as const;

export default function RimowaMargielaClient() {
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  };

  return (
    // -mb-16 снимает отступ подвала: тёмный блок предзаказа переходит прямо в тёмный подвал.
    <main className="-mb-16 min-h-screen text-[#191917]" style={{ backgroundColor: PAPER }}>
      {/* ---------- Фильм ---------- */}
      <section className="relative h-[82svh] min-h-[540px] w-full overflow-hidden bg-[#191917] text-white sm:h-[90vh]">
        <video
          ref={videoRef}
          key={isMobile ? "m" : "d"}
          src={toProxiedVideoUrl(isMobile ? FILM_MOBILE : FILM)}
          poster={toProxiedImageUrl(STILL_ROOM)}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-between px-5 pb-10 pt-8 sm:px-8 sm:pb-14 lg:px-12">
          <div className="flex items-start justify-between gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.34em] text-white/70">
              Stage Store · Предзаказ
            </span>
            <button
              type="button"
              onClick={toggleSound}
              className="rounded-full border border-white/30 bg-black/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.26em] text-white/80 backdrop-blur transition hover:border-white hover:text-white"
              aria-label={muted ? "Включить звук" : "Выключить звук"}
            >
              {muted ? "Звук ○" : "Звук ●"}
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-white/60">
              Bianchetto · Limited edition
            </p>
            <h1 className="mt-5 text-[clamp(2.8rem,9vw,7.5rem)] font-bold uppercase leading-[0.86] tracking-[-0.06em]">
              RIMOWA
              <span className="block font-light normal-case tracking-[-0.04em] text-white/55">
                × Maison Margiela
              </span>
            </h1>

            <div className="mt-8 flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
                  До выхода · 19.11.2026
                </div>
                <Countdown />
              </div>
              <a
                href="#preorder"
                className="group inline-flex w-fit items-center rounded-full bg-white px-8 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-black transition duration-300 hover:bg-[#f2efe9]"
              >
                Записаться на предзаказ
                <span className="ml-3 transition-transform duration-300 group-hover:translate-x-1">→</span>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- Идея ---------- */}
      <section className="relative overflow-hidden" style={GROOVES}>
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-12">
          <motion.div {...reveal}>
            <Label className="relative inline-block">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-black/45">N° 01 / Идея</div>
              <div className="mt-1 font-mono text-sm">Bianchetto</div>
            </Label>
            <h2 className="mt-8 text-4xl font-bold leading-[0.95] tracking-[-0.05em] sm:text-6xl">
              Белое, которое
              <span className="block font-light text-black/45">помнит дорогу</span>
            </h2>
          </motion.div>

          <motion.div {...reveal} className="space-y-6 text-[15px] leading-7 text-black/70 sm:text-base sm:leading-8">
            <p>
              Бьянкетто — белила, которыми Maison Margiela вручную покрывает вещи. В 1988 году
              Мартин Маржела и Дженни Мейренс выкрасили так свою первую студию, а через год —
              ранние Tabi. Слой нарочно тонкий: он трескается и стирается, и под ним проступает
              история самой вещи.
            </p>
            <p>
              У RIMOWA та же философия, только в алюминии: вмятины и царапины на чемодане — не
              дефект, а память о поездках. В коллаборации две идеи «прожитой» вещи сходятся в
              одном комплекте — чемодане и сумке, которые стареют вместе с владельцем.
            </p>
            <div className="grid grid-cols-3 gap-px overflow-hidden border border-black/10 bg-black/10 pt-0 font-mono text-[11px] uppercase tracking-[0.18em]">
              {[
                ["Выход", "19.11.2026"],
                ["Тираж", "Ограничен"],
                ["Роспись", "Ручная"],
              ].map(([k, v]) => (
                <div key={k} className="bg-[#f2efe9] px-4 py-4">
                  <div className="text-black/40">{k}</div>
                  <div className="mt-1.5 text-black">{v}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- Комплект ---------- */}
      <section className="relative">
        <div className="relative h-[70svh] min-h-[460px] w-full overflow-hidden">
          <Image src={toProxiedImageUrl(STILL_SET)} alt="Сумка 5AC XL на ручке чемодана Classic Cabin в выбеленной парижской квартире" fill sizes="100vw" className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-7xl items-end justify-between gap-6 px-5 pb-8 text-white sm:px-8 lg:px-12">
            <p className="max-w-md font-mono text-[11px] uppercase leading-5 tracking-[0.22em] text-white/80">
              Комплект: сумка 5AC XL садится на ручку Classic Cabin
            </p>
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.26em] text-white/50 sm:block">
              Фильм — Dexter Lander, Париж
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Два предмета ---------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <motion.div {...reveal} className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <h2 className="text-4xl font-bold leading-[0.95] tracking-[-0.05em] sm:text-6xl">
            Два предмета
            <span className="block font-light text-black/45">один след</span>
          </h2>
          <p className="max-w-sm text-sm leading-6 text-black/55">
            В фильме кампании белила заливают квартиру целиком — и на стенах остаются только
            отпечатки чемодана и сумки.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-8">
          {OBJECTS.map((o, i) => (
            <motion.article key={o.n} {...reveal} transition={{ ...reveal.transition, delay: i * 0.12 }}>
              <div className="group relative aspect-[4/3] overflow-hidden bg-[#e7e3dc]">
                <Image
                  src={toProxiedImageUrl(o.image)}
                  alt={o.alt}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover grayscale-[35%] transition duration-[1400ms] ease-out group-hover:scale-[1.03] group-hover:grayscale-0"
                  unoptimized
                />
                <Label className="absolute left-4 top-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-black/45">
                    N° {o.n} / {o.house}
                  </div>
                </Label>
              </div>
              <div className="mt-7 flex items-baseline justify-between gap-4 border-b border-black/15 pb-5">
                <h3 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{o.name}</h3>
                <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-black/40">19.11</span>
              </div>
              <ul className="mt-5 space-y-3">
                {o.lines.map((line) => (
                  <li key={line} className="flex gap-4 text-[15px] leading-6 text-black/70">
                    <span className="mt-[9px] h-px w-5 shrink-0 bg-black/35" />
                    {line}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ---------- Предзаказ ---------- */}
      <PreorderSection />
    </main>
  );
}

function PreorderSection() {
  const [choice, setChoice] = useState<(typeof CHOICES)[number]>("Комплект");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [comment, setComment] = useState("");
  const [pdConsent, setPdConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = contact.trim().length >= 5 && pdConsent && !sending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          category: `RIMOWA × Maison Margiela · ${choice}`,
          notes: comment.trim() ? `Комментарий: ${comment.trim()}` : "Предзаказ к выходу 19.11.2026",
          source: "Страница RIMOWA × Maison Margiela",
          pdConsent: true,
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError(`Не удалось отправить. Попробуйте ещё раз или напишите нам в Telegram ${COMPANY.telegram}.`);
    } finally {
      setSending(false);
    }
  }

  const input =
    "w-full border-b border-white/20 bg-transparent py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-white";

  return (
    <section id="preorder" className="scroll-mt-20 text-white" style={{ backgroundColor: INK }}>
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:gap-20 lg:px-12">
        <motion.div {...reveal}>
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-white/45">N° 03 / Предзаказ</p>
          <h2 className="mt-6 text-4xl font-bold leading-[0.95] tracking-[-0.05em] sm:text-6xl">
            Тираж ограничен
            <span className="block font-light text-white/45">займите место заранее</span>
          </h2>
          <p className="mt-8 max-w-md text-[15px] leading-7 text-white/60">
            Оставьте контакт — консьерж Stage Store свяжется с вами, назовёт стоимость и сроки и
            закрепит позицию за вами к выходу коллекции. Оригинал с гарантией подлинности.
          </p>
          <div className="mt-12 hidden lg:block">
            <NumberRow dark />
          </div>
        </motion.div>

        <motion.div {...reveal}>
          {done ? (
            <div className="flex h-full flex-col justify-center border border-white/15 p-8 sm:p-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-white/45">Заявка принята</p>
              <div className="mt-4 text-3xl font-bold tracking-[-0.04em]">Вы в списке</div>
              <p className="mt-4 text-[15px] leading-7 text-white/60">
                {choice} · RIMOWA × Maison Margiela. Мы напишем вам до 19 ноября.
              </p>
              <Link
                href="/brand/maison-margiela"
                className="mt-8 inline-flex w-fit rounded-full border border-white/25 px-7 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/80 transition hover:border-white hover:text-white"
              >
                Maison Margiela в Stage Store →
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-8">
              <div>
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">Что интересует</div>
                <div className="flex flex-wrap gap-2">
                  {CHOICES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChoice(c)}
                      className={`rounded-full border px-5 py-2.5 text-sm transition ${
                        choice === c
                          ? "border-white bg-white font-semibold text-black"
                          : "border-white/20 text-white/70 hover:border-white/50 hover:text-white"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">Имя</span>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться" autoComplete="name" maxLength={120} />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">Телефон или Telegram</span>
                <input className={input} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+7 … или @username" autoComplete="tel" maxLength={160} required />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">Комментарий</span>
                <input className={input} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" maxLength={600} />
              </label>

              <PdConsentCheckbox tone="dark" checked={pdConsent} onChange={setPdConsent} />

              {error && <p className="text-sm text-red-300">{error}</p>}

              <button
                type="submit"
                disabled={!canSend}
                className="group inline-flex w-full items-center justify-center rounded-full bg-white px-8 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-black transition hover:bg-[#f2efe9] disabled:opacity-30 sm:w-auto"
              >
                {sending ? "Отправляем…" : "Записаться на предзаказ"}
                {!sending && <span className="ml-3 transition-transform group-hover:translate-x-1">→</span>}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
