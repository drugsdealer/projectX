"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { IBM_Plex_Mono, Oswald } from "next/font/google";
import { getOptimizedImageUrl, shouldBypassNextImageOptimization } from "@/lib/media";
import { CompassBadge } from "@/components/promos/StoneIslandBanner";

const mono = IBM_Plex_Mono({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], display: "swap" });
const display = Oswald({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], display: "swap" });

export type SiItem = {
  id: number;
  name: string;
  href: string;
  price: number;
  oldPrice: number | null;
  images: string[];
  material: string;
  subcategory: string;
  sizes: string[];
  createdAt: number;
};

// Палитра: графитовый чёрный, как фон предметной съёмки, и жёлтый вышитого компаса.
const INK = "#0d0d0c";
const TEXT = "#ece8df";
const ACCENT = "#d9c44a";

const TYPES = [
  { key: "jackets", label: "Куртки", match: ["jackets", "coats", "bombers", "parkas"] },
  { key: "shirts", label: "Овершоты", match: ["shirts", "overshirts"] },
  { key: "hoodies", label: "Худи и свитшоты", match: ["hoodies", "sweatshirts"] },
  { key: "knit", label: "Трикотаж", match: ["sweaters", "knitwear", "cardigans"] },
  { key: "shorts", label: "Шорты", match: ["shorts", "trousers", "pants"] },
  { key: "acc", label: "Аксессуары", match: ["waistbags", "bags", "caps", "hats", "accessories"] },
] as const;

const TYPE_SINGULAR: Record<string, string> = {
  jackets: "Куртка",
  shirts: "Овершот",
  hoodies: "Худи",
  knit: "Трикотаж",
  shorts: "Шорты",
  acc: "Аксессуар",
};

// Техники, ради которых Stone Island и покупают. Определяем по названию и составу.
const TECHNIQUES = [
  {
    key: "nylon-metal",
    code: "01",
    name: "Nylon Metal",
    test: /nylon metal/i,
    text: "Нейлон, переплетённый так, что ткань переливается, как металл. Лёгкий, шуршащий, с перламутровым отливом, который меняется на свету.",
  },
  {
    key: "garment-dyed",
    code: "02",
    name: "Garment Dyeing",
    test: /garment dyed|piattina|ovd|off-dye|dyed/i,
    text: "Вещь окрашивают уже сшитой: краска по-разному ложится на ткань, нитки и швы, поэтому у каждой свой оттенок. В архиве бренда — более 60 000 рецептов цвета.",
  },
  {
    key: "fleece",
    code: "03",
    name: "Cotton Fleece",
    test: /fleece|хлоп/i,
    text: "Плотный футер из органического хлопка, окрашенный после пошива. Мягкий с первого дня, держит форму и не садится.",
  },
  {
    key: "technical",
    code: "04",
    name: "Technical",
    test: /econyl|anti-drop|panama|coated|twill|полиамид|полиэстер/i,
    text: "Переработанный нейлон ECONYL®, водоотталкивающие пропитки Anti-Drop и прорезиненные покрытия — одежда, рассчитанная на городскую погоду.",
  },
] as const;

const SORTS = [
  { key: "new", label: "Сначала новые" },
  { key: "cheap", label: "Сначала дешевле" },
  { key: "expensive", label: "Сначала дороже" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

function typeOf(item: SiItem) {
  const sub = item.subcategory.toLowerCase();
  return TYPES.find((t) => (t.match as readonly string[]).includes(sub))?.key ?? null;
}

function techniquesOf(item: SiItem): string[] {
  const hay = `${item.name} ${item.material}`;
  return TECHNIQUES.filter((t) => t.test.test(hay)).map((t) => t.key);
}

function shortName(name: string) {
  return name.replace(/^stone island\s+/i, "");
}

function formatPrice(n: number) {
  return `${n.toLocaleString("ru-RU").replace(/,/g, " ")} ₽`;
}

function shortMaterial(material: string) {
  return material.replace(/\s*\([^)]*\)/g, "").trim();
}

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
} as const;

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`${mono.className} text-[10px] uppercase tracking-[0.28em] text-[#ece8df]/50 ${className}`}>{children}</span>
  );
}

// Миллиметровка под всем первым экраном — как лист технического чертежа.
const GRID_PAPER = {
  backgroundImage:
    "linear-gradient(rgba(236,232,223,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(236,232,223,0.045) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
};

function HeroPlate({ hero }: { hero: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pt, setPt] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const src = getOptimizedImageUrl(hero, { width: 1920, quality: 85 });

  return (
    <div
      ref={ref}
      className="relative w-full cursor-crosshair overflow-hidden border border-[#ece8df]/15"
      style={{ aspectRatio: "1200 / 595" }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        setPt({ x, y, px: Math.round((x / r.width) * 100), py: Math.round((y / r.height) * 100) });
      }}
      onMouseLeave={() => setPt(null)}
    >
      <Image
        src={src}
        alt="Кампания Stone Island"
        fill
        priority
        sizes="(min-width: 1280px) 1200px, 100vw"
        className="object-cover"
        unoptimized={shouldBypassNextImageOptimization(src)}
      />

      {/* выноски к нашивкам-компасам на рукавах */}
      {[
        { x: 65.4, y: 43, label: "Badge · левый рукав" },
        { x: 94, y: 55.5, label: "Badge · 1982" },
      ].map((p) => (
        <div key={p.label} className="pointer-events-none absolute hidden sm:block" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full border border-[#d9c44a]" />
          <span className="absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-full bg-[#d9c44a]" />
          {/* у правой метки выноска уходит влево, чтобы подпись не вылезала за край */}
          <span
            className="absolute top-2 h-px w-10 bg-[#d9c44a]/80"
            style={p.x > 80 ? { right: 8, transformOrigin: "right", transform: "rotate(-45deg)" } : { left: 8, transformOrigin: "left", transform: "rotate(45deg)" }}
          />
          <span
            className={`${mono.className} absolute top-9 whitespace-nowrap border border-[#d9c44a]/60 bg-black/70 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#d9c44a]`}
            style={p.x > 80 ? { right: 32 } : { left: 32 }}
          >
            {p.label}
          </span>
        </div>
      ))}

      {/* перекрестье с координатами, как на баннере главной */}
      {pt && (
        <>
          <div className="pointer-events-none absolute inset-x-0 h-px bg-white/40" style={{ top: pt.y }} />
          <div className="pointer-events-none absolute inset-y-0 w-px bg-white/40" style={{ left: pt.x }} />
          <div
            className={`${mono.className} pointer-events-none absolute translate-x-3 translate-y-3 whitespace-nowrap border border-white/30 bg-black/55 px-2 py-0.5 text-[9px] tracking-[0.14em] text-white/90`}
            style={{ left: pt.x, top: pt.y }}
          >
            X {pt.px} · Y {pt.py}
          </div>
        </>
      )}

      {/* метки углов */}
      <span className={`${mono.className} absolute left-3 top-3 text-[9px] uppercase tracking-[0.24em] text-black/55`}>Fig. 01</span>
      <span className={`${mono.className} absolute right-3 top-3 text-[9px] uppercase tracking-[0.24em] text-black/55`}>Archivio</span>
    </div>
  );
}

function ProductTile({ item, index }: { item: SiItem; index: number }) {
  const t = typeOf(item);
  const main = getOptimizedImageUrl(item.images[0], { width: 720 });
  const alt = item.images[1] ? getOptimizedImageUrl(item.images[1], { width: 720 }) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: (index % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={item.href} className="group block">
        <div className="relative aspect-[4/5] overflow-hidden bg-black">
          {main ? (
            <Image
              src={main}
              alt={item.name}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              className={`object-contain transition duration-700 ease-out group-hover:scale-[1.03] ${alt ? "group-hover:opacity-0" : ""}`}
              unoptimized={shouldBypassNextImageOptimization(main)}
            />
          ) : null}
          {alt ? (
            <Image
              src={alt}
              alt=""
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="object-contain opacity-0 transition duration-700 ease-out group-hover:opacity-100"
              unoptimized={shouldBypassNextImageOptimization(alt)}
            />
          ) : null}

          <span className={`${mono.className} absolute left-2.5 top-2.5 text-[9px] uppercase tracking-[0.22em] text-[#ece8df]/45 sm:left-3 sm:top-3`}>
            Art. {String(item.id).padStart(5, "0")}
          </span>
          <span className="absolute right-2.5 top-2.5 opacity-40 transition duration-700 group-hover:rotate-90 group-hover:opacity-90 sm:right-3 sm:top-3">
            <CompassBadge size={22} color={ACCENT} />
          </span>
          {item.oldPrice && item.oldPrice > item.price ? (
            <span className={`${mono.className} absolute bottom-2.5 left-2.5 bg-[#d9c44a] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-black`}>
              Sale
            </span>
          ) : null}
        </div>

        <div className="border-x border-b border-[#ece8df]/10 px-2.5 pb-3 pt-2.5 transition-colors duration-300 group-hover:border-[#d9c44a]/40 sm:px-3 sm:pb-4">
          <Label className="block truncate !text-[9px] !tracking-[0.22em]">
            {t ? TYPE_SINGULAR[t] : "Stone Island"}
          </Label>
          <h3 className={`${display.className} mt-1.5 line-clamp-2 min-h-[2.5em] text-[15px] uppercase leading-[1.25] tracking-[0.02em] text-[#ece8df] sm:text-[17px]`}>
            {shortName(item.name)}
          </h3>
          {item.material ? (
            <p className={`${mono.className} mt-1.5 line-clamp-1 text-[10px] text-[#ece8df]/45`}>{shortMaterial(item.material)}</p>
          ) : null}
          {item.sizes.length ? (
            <div className={`${mono.className} mt-2.5 hidden flex-wrap gap-1 sm:flex`}>
              {item.sizes.map((s) => (
                <span key={s} className="border border-[#ece8df]/15 px-1.5 py-0.5 text-[9px] text-[#ece8df]/60">
                  {s}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`${mono.className} text-[13px] font-medium text-[#ece8df] sm:text-sm`}>от {formatPrice(item.price)}</span>
            {item.oldPrice && item.oldPrice > item.price ? (
              <span className={`${mono.className} text-[11px] text-[#ece8df]/35 line-through`}>{formatPrice(item.oldPrice)}</span>
            ) : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${mono.className} shrink-0 border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors ${
        active
          ? "border-[#d9c44a] bg-[#d9c44a] text-black"
          : "border-[#ece8df]/20 text-[#ece8df]/70 hover:border-[#ece8df]/60 hover:text-[#ece8df]"
      }`}
    >
      {children}
    </button>
  );
}

export default function StoneIslandClient({ items, hero }: { items: SiItem[]; hero: string }) {
  const [type, setType] = useState<string | null>(null);
  const [tech, setTech] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("new");
  const catalogRef = useRef<HTMLElement>(null);

  const enriched = useMemo(
    () => items.map((it) => ({ it, type: typeOf(it), techs: techniquesOf(it) })),
    [items]
  );

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of enriched) if (e.type) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return m;
  }, [enriched]);

  const techCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of enriched) for (const k of e.techs) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, [enriched]);

  const visible = useMemo(() => {
    const list = enriched.filter((e) => (!type || e.type === type) && (!tech || e.techs.includes(tech))).map((e) => e.it);
    if (sort === "cheap") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "expensive") return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [enriched, type, tech, sort]);

  const minPrice = items.length ? Math.min(...items.map((i) => i.price)) : 0;

  const scrollToCatalog = () => catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    // -mb-16 снимает отступ подвала: тёмная страница переходит прямо в тёмный подвал.
    <main className={`${mono.className} -mb-16 min-h-screen overflow-x-hidden`} style={{ backgroundColor: INK, color: TEXT }}>
      {/* ---------- Первый экран ---------- */}
      <section id="brand-hero" className="relative" style={GRID_PAPER}>
        <div className="mx-auto max-w-[1320px] px-4 pb-14 pt-28 sm:px-8 sm:pb-20 sm:pt-32 lg:px-12">
          <motion.div {...reveal} className="flex items-start justify-between gap-6">
            <Label>Stage Store · Archivio</Label>
            <Label className="hidden text-right sm:block">44.72° N · 11.10° E — Ravarino, Italia</Label>
          </motion.div>

          <div className="mt-8 flex items-end justify-between gap-6 sm:mt-12">
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className={`${display.className} text-[clamp(56px,13.5vw,196px)] font-semibold uppercase leading-[0.86] tracking-[-0.01em]`}
            >
              Stone
              <br />
              Island
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, rotate: -40 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mb-3 shrink-0"
            >
              <div className="animate-[spin_40s_linear_infinite] motion-reduce:animate-none">
                <CompassBadge size={128} color={ACCENT} />
              </div>
            </motion.div>
          </div>

          <div className="mt-10 grid gap-10 border-t border-[#ece8df]/15 pt-8 sm:mt-14 lg:grid-cols-12">
            <motion.p {...reveal} className="text-[15px] leading-relaxed text-[#ece8df]/80 sm:text-base lg:col-span-6">
              Лаборатория материалов с 1982 года. Нейлон, который блестит как металл, ткани, меняющие цвет от тепла,
              и окрашивание уже сшитой вещи — поэтому двух одинаковых вещей Stone Island не бывает.
            </motion.p>
            <motion.dl {...reveal} className="grid grid-cols-3 gap-4 lg:col-span-6 lg:pl-10">
              {[
                { k: "В наличии", v: String(items.length) },
                { k: "Цены от", v: minPrice ? formatPrice(minPrice) : "—" },
                { k: "Подлинность", v: "100%" },
              ].map((s) => (
                <div key={s.k} className="border-l border-[#ece8df]/15 pl-3 sm:pl-4">
                  <dt>
                    <Label className="!text-[9px]">{s.k}</Label>
                  </dt>
                  <dd className={`${display.className} mt-2 text-xl font-medium sm:text-3xl`}>{s.v}</dd>
                </div>
              ))}
            </motion.dl>
          </div>

          <motion.div {...reveal} className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={scrollToCatalog}
              className="bg-[#d9c44a] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-black transition hover:bg-[#ece8df]"
            >
              Смотреть коллекцию ↓
            </button>
            <a
              href="#original"
              className="border border-[#ece8df]/30 px-6 py-3.5 text-[11px] uppercase tracking-[0.24em] text-[#ece8df]/85 transition hover:border-[#ece8df] hover:text-[#ece8df]"
            >
              Как отличить оригинал
            </a>
          </motion.div>

          <motion.div {...reveal} className="mt-14 sm:mt-20">
            <HeroPlate hero={hero} />
            <div className="mt-3 flex justify-between gap-4">
              <Label className="!text-[9px]">Fig. 01 — Нашивка-компас: съёмная, на двух пуговицах</Label>
              <Label className="hidden !text-[9px] sm:block">Stone Island · Archivio</Label>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- Лаборатория ---------- */}
      <section className="border-t border-[#ece8df]/10">
        <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12">
          <motion.div {...reveal} className="flex items-end justify-between gap-6">
            <div>
              <Label>02 — Ricerca</Label>
              <h2 className={`${display.className} mt-3 text-4xl font-medium uppercase sm:text-6xl`}>Лаборатория</h2>
            </div>
            <p className="hidden max-w-sm text-sm leading-relaxed text-[#ece8df]/55 md:block">
              Stone Island начинает не с силуэта, а с ткани. Выберите технику — покажем вещи, в которых она есть.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-px bg-[#ece8df]/10 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
            {TECHNIQUES.filter((t) => techCounts.get(t.key)).map((t, i) => (
              <motion.button
                key={t.key}
                type="button"
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.08 }}
                onClick={() => {
                  setTech(t.key);
                  setType(null);
                  scrollToCatalog();
                }}
                className="group flex flex-col p-6 sm:min-h-[280px] text-left transition-colors hover:bg-[#151513] sm:p-7"
                style={{ backgroundColor: INK }}
              >
                <div className="flex items-center justify-between">
                  <Label className="!text-[#d9c44a]">{t.code}</Label>
                  <span className="h-2 w-2 rounded-full border border-[#d9c44a] transition group-hover:bg-[#d9c44a]" />
                </div>
                <h3 className={`${display.className} mt-6 text-2xl font-medium uppercase tracking-[0.02em]`}>{t.name}</h3>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-[#ece8df]/60">{t.text}</p>
                <span className="mt-6 text-[10px] uppercase tracking-[0.24em] text-[#ece8df]/80 transition group-hover:text-[#d9c44a]">
                  {techCounts.get(t.key)} {plural(techCounts.get(t.key) ?? 0)} →
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Коллекция ---------- */}
      <section ref={catalogRef} id="catalog" className="scroll-mt-[var(--header-h,64px)] border-t border-[#ece8df]/10">
        <div className="mx-auto max-w-[1320px] px-4 pt-16 sm:px-8 sm:pt-24 lg:px-12">
          <motion.div {...reveal} className="flex items-end justify-between gap-6">
            <div>
              <Label>03 — Collezione</Label>
              <h2 className={`${display.className} mt-3 text-4xl font-medium uppercase sm:text-6xl`}>Коллекция</h2>
            </div>
            <div className="flex flex-col items-end gap-3">
              <Label className="!text-[11px]">
                {visible.length} / {items.length}
              </Label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Сортировка"
                className="shrink-0 cursor-pointer border border-[#ece8df]/20 bg-transparent px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#ece8df]/80 outline-none hover:border-[#ece8df]/60"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key} className="bg-[#0d0d0c]">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        </div>

        {/* sticky здесь не сработает: в globals.css у html/body overflow-x: hidden */}
        <div className="mt-8 border-y border-[#ece8df]/10 bg-[#111110]">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-2.5 px-4 py-3 sm:px-8 lg:px-12">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              <Chip active={!type} onClick={() => setType(null)}>
                Всё
              </Chip>
              {TYPES.filter((t) => typeCounts.get(t.key)).map((t) => (
                <Chip key={t.key} active={type === t.key} onClick={() => setType(type === t.key ? null : t.key)}>
                  {t.label} <span className="opacity-50">{typeCounts.get(t.key)}</span>
                </Chip>
              ))}
            </div>
            <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              <Label className="mr-1 hidden shrink-0 !text-[9px] sm:inline">Техника</Label>
              {TECHNIQUES.filter((t) => techCounts.get(t.key)).map((t) => (
                <Chip key={t.key} active={tech === t.key} onClick={() => setTech(tech === t.key ? null : t.key)}>
                  {t.name}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1320px] px-4 pb-20 pt-8 sm:px-8 sm:pb-28 lg:px-12">
          {visible.length ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8 md:grid-cols-3 xl:grid-cols-4">
              {visible.map((it, i) => (
                <ProductTile key={it.id} item={it} index={i} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 border border-dashed border-[#ece8df]/15 py-20 text-center">
              <CompassBadge size={48} color="#ece8df" opacity={0.35} />
              <p className="text-sm text-[#ece8df]/60">По этим фильтрам вещей сейчас нет.</p>
              <button
                type="button"
                onClick={() => {
                  setType(null);
                  setTech(null);
                }}
                className="border border-[#ece8df]/30 px-5 py-2.5 text-[10px] uppercase tracking-[0.24em] hover:border-[#ece8df]"
              >
                Сбросить фильтры
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Как отличить оригинал ---------- */}
      <section id="original" className="scroll-mt-[var(--header-h,64px)] border-t border-[#ece8df]/10" style={GRID_PAPER}>
        <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-12 lg:px-12">
          <motion.div {...reveal} className="lg:col-span-4">
            <Label>04 — Autenticità</Label>
            <h2 className={`${display.className} mt-3 text-4xl font-medium uppercase leading-[1.05] sm:text-5xl`}>
              Как отличить оригинал
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[#ece8df]/60">
              Stone Island — одна из самых подделываемых марок. Мы проверяем каждую вещь перед отправкой и продаём только оригинал.
            </p>
          </motion.div>
          <div className="grid gap-px bg-[#ece8df]/10 sm:grid-cols-2 lg:col-span-8">
            {[
              {
                n: "01",
                t: "Нашивка-компас",
                d: "Вышитый компас на левом рукаве. Нашивка съёмная и крепится на две пуговицы — её можно отстегнуть.",
              },
              {
                n: "02",
                t: "Код подлинности",
                d: "Внутри вещи — бирка с уникальным кодом, который проверяется онлайн. Код у каждой вещи свой.",
              },
              {
                n: "03",
                t: "Фурнитура",
                d: "Пуговицы, кнопки и бегунки молний с гравировкой бренда, ровная строчка и плотная, тяжёлая ткань.",
              },
              {
                n: "04",
                t: "Проверка Stage Store",
                d: "Каждую вещь осматриваем до отправки: бирки, нашивку, фурнитуру, швы. Если сомневаетесь — покажем вещь вживую в Москве.",
              },
            ].map((x, i) => (
              <motion.div
                key={x.n}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.08 }}
                className="p-6 sm:p-8"
                style={{ backgroundColor: INK }}
              >
                <Label className="!text-[#d9c44a]">{x.n}</Label>
                <h3 className={`${display.className} mt-4 text-xl font-medium uppercase`}>{x.t}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[#ece8df]/60">{x.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Под заказ ---------- */}
      <section className="border-t border-[#ece8df]/10">
        <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-8 px-4 py-16 sm:px-8 sm:py-20 md:flex-row md:items-center lg:px-12">
          <motion.div {...reveal} className="flex items-center gap-6">
            <CompassBadge size={56} color={ACCENT} />
            <div>
              <h2 className={`${display.className} text-2xl font-medium uppercase sm:text-4xl`}>Нет нужной модели?</h2>
              <p className="mt-2 text-sm text-[#ece8df]/60">Привезём любую вещь Stone Island под заказ — с той же проверкой подлинности.</p>
            </div>
          </motion.div>
          <motion.div {...reveal}>
            <Link
              href="/concierge"
              className="inline-block border border-[#d9c44a] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d9c44a] transition hover:bg-[#d9c44a] hover:text-black"
            >
              Оставить заявку →
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

function plural(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "вещь";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "вещи";
  return "вещей";
}
