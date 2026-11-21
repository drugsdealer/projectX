"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FloatingBottles from "@/components/promos/beauty/FloatingBottles";
import {
  BEAUTY_COLORS as C,
  HERO_BOTTLES,
  HERO_BOTTLES_MIX,
  fontBody,
  fontDisplay,
  fontMono,
  fontSerif,
} from "@/components/promos/beauty/theme";
import { PouchCollage, PouchPicker, pouchesFor, useGiftChoice } from "@/components/promos/beauty/PouchPicker";
import { getOptimizedImageUrl, shouldBypassNextImageOptimization } from "@/lib/media";
import { BEAUTY_PROMO, beautyProgress, findPouch, formatRub, isBeautyPromoActive, type BeautyProgress } from "@/lib/promo-beauty";

export type BeautyItem = {
  id: number;
  name: string;
  brandKey: string;
  brandName: string;
  category: string;
  sub: string;
  price: number;
  oldPrice: number | null;
  image: string | null;
  href: string;
};

const THRESHOLD = formatRub(BEAUTY_PROMO.threshold);
// Дальние флаконы — под фото, ближние — поверх (массивы постоянные, чтобы анимация не перезапускалась).
const split = (list: typeof HERO_BOTTLES) => ({
  back: list.filter((b) => (b.z ?? 1) === 0),
  front: list.filter((b) => (b.z ?? 1) > 0),
});
const HERO_DIOR = split(HERO_BOTTLES);
const HERO_MIX = split(HERO_BOTTLES_MIX);

function joinBrands(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0] ?? "";
}

function endsLabel() {
  if (!BEAUTY_PROMO.endsAt) return null;
  const d = new Date(`${BEAUTY_PROMO.endsAt}T12:00:00+03:00`);
  return `до ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}

/** Корзина посетителя → сколько набрано на подарок (бренды акции вместе). */
function useCartProgress(items: BeautyItem[]) {
  const [progress, setProgress] = useState<BeautyProgress | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/cart", { cache: "no-store", credentials: "same-origin" });
        const data = await res.json().catch(() => null);
        const rows: any[] = Array.isArray(data?.items) ? data.items : [];
        const lines = rows
          .filter((r) => !r?.postponed)
          .map((r) => {
            const p = byId.get(Number(r?.productId));
            return p ? { brand: p.brandName, category: p.category, price: Number(r?.price) || 0, quantity: Number(r?.quantity) || 0 } : null;
          })
          .filter(Boolean) as { brand: string; category: string; price: number; quantity: number }[];
        if (alive) setProgress(beautyProgress(lines));
      } catch {
        if (alive) setProgress(beautyProgress([]));
      }
    };
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener("cart:refresh", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("cart:refresh", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [byId]);

  return progress;
}

export default function BeautyWeekClient({ items }: { items: BeautyItem[] }) {
  const active = isBeautyPromoActive();
  const brands = useMemo(
    () => BEAUTY_PROMO.brands.filter((b) => items.some((i) => i.brandKey === b.key)),
    [items]
  );
  const shownBrands = brands.length ? brands : BEAUTY_PROMO.brands.slice(0, 1);
  const brandLine = joinBrands(shownBrands.map((b) => b.name));
  const giftLine = `косметичка ${shownBrands.map((b) => b.name).join(" или ")} на выбор`;
  const hero = shownBrands.length > 1 ? HERO_MIX : HERO_DIOR;
  const hasFragrance = items.some((i) => i.category === "fragrance");
  const goods = hasFragrance ? "косметику или парфюм" : "косметику";
  const { choice, choose } = useGiftChoice();
  const pouches = useMemo(() => pouchesFor(shownBrands), [shownBrands]);
  const chosenPouch = findPouch(choice);
  const brandsAnd = shownBrands.map((b) => b.name).join(" и ");
  const maxDiscount = items.reduce(
    (m, i) => (i.oldPrice ? Math.max(m, Math.round((1 - i.price / i.oldPrice) * 100)) : m),
    0
  );
  const ends = endsLabel();

  const [brandFilter, setBrandFilter] = useState<string>("all");
  const visible = brandFilter === "all" ? items : items.filter((i) => i.brandKey === brandFilter);

  const progress = useCartProgress(items);
  const top = progress && progress.total > 0 ? progress : null;

  const label = `${fontMono.className} text-[11px] leading-[14px] tracking-[.14em] uppercase`;
  const disp = `${fontDisplay.className} uppercase font-light tracking-[-.01em]`;
  const serif = `${fontSerif.className} italic`;
  const btn =
    "inline-flex items-center justify-center min-h-[48px] px-7 text-[15px] font-bold border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div className={fontBody.className} style={{ background: C.cream, color: C.ink }}>
      <div className="text-center px-4 py-3" style={{ background: C.ink, color: C.cream }}>
        <span className={label}>
          {active ? `Подарок от ${THRESHOLD} — ${giftLine}` : "Акция завершилась — спасибо, что были с нами"}
        </span>
      </div>

      {/* ── Первый экран ── */}
      <section className="mx-auto max-w-[1280px] px-4 md:px-10" style={{ overflowX: "clip" }}>
        <div className="flex flex-col md:flex-row md:items-center gap-10 md:gap-14 pt-8 pb-16 md:pt-12 md:pb-24">
          <div className="flex-1 min-w-0">
            <div className={label} style={{ color: C.inkMuted, marginBottom: 28 }}>
              Beauty edit · Stage Store{ends ? ` · ${ends}` : ""}
            </div>
            <h1 className={`${disp} m-0 text-[60px] leading-[.92] sm:text-[84px] lg:text-[116px]`}>
              Бьюти-
              <br />
              неделя
            </h1>
            <p className={`${serif} mt-2 mb-0 text-[48px] leading-none sm:text-[64px] lg:text-[84px]`} style={{ color: C.accent }}>
              {brandLine}
            </p>
            <p className="text-[18px] leading-7 max-w-[460px] mt-8 mb-10" style={{ color: C.text }}>
              {maxDiscount >= 5 ? `Скидки до ${maxDiscount}% на косметику. ` : ""}
              Закажите {goods} {brandsAnd} на {THRESHOLD} и больше — {shownBrands.length > 1 ? "бренды можно смешивать" : "в любом сочетании"} —
              и выберите любую косметичку в подарок.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#catalog" className={btn} style={{ background: C.ink, color: C.cream, borderColor: C.ink }}>
                Выбрать косметику
              </a>
              <a href="#gift" className={btn} style={{ background: "transparent", color: C.ink, borderColor: C.ink }}>
                Условия подарка
              </a>
            </div>
          </div>

          <div className="w-full md:w-[46%] md:flex-none min-w-0">
            <div className="relative w-full max-w-[560px] mx-auto" style={{ aspectRatio: "9 / 10" }}>
              <FloatingBottles items={hero.back} eager />
              <div
                className="absolute overflow-hidden"
                style={{ left: "8%", top: 0, width: "84%", height: "100%", borderRadius: "999px 999px 0 0", zIndex: 1 }}
              >
                <Image
                  src={shownBrands[0].cover}
                  alt={`${shownBrands[0].name} — косметика`}
                  fill
                  priority
                  sizes="(max-width: 768px) 90vw, 520px"
                  className="object-cover"
                />
              </div>
              <FloatingBottles items={hero.front} style={{ zIndex: 3 }} eager />
              <div
                className="absolute"
                style={{
                  left: "-2%",
                  top: "9%",
                  width: "max(36%, 150px)",
                  transform: "rotate(-6deg)",
                  background: C.cream,
                  border: `1px solid ${C.ink}`,
                  padding: "14px 14px 16px",
                  boxShadow: "0 10px 20px rgba(120,50,60,.18)",
                  zIndex: 5,
                }}
              >
                <div
                  style={{ width: 12, height: 12, borderRadius: "50%", border: `1px solid ${C.ink}`, background: C.blush, margin: "0 auto 10px" }}
                />
                <div className={label} style={{ color: C.inkMuted, fontSize: 10 }}>
                  Подарок
                </div>
                <div className={`${fontDisplay.className} uppercase`} style={{ fontSize: 22, lineHeight: "24px", marginTop: 6, whiteSpace: "nowrap" }}>
                  от {THRESHOLD}
                </div>
                <div style={{ fontSize: 13, lineHeight: "18px", marginTop: 6, color: C.text }}>косметичка на выбор</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Подарок ── */}
      <section id="gift" className="relative overflow-hidden scroll-mt-20" style={{ background: C.blush }}>
        <div className="relative mx-auto max-w-[1280px] px-4 md:px-10 py-14 md:py-[88px]" style={{ zIndex: 2 }}>
          <div className="flex flex-col md:flex-row gap-10 md:gap-14 md:items-start">
            <div className="flex-1 min-w-0">
              <div className={label} style={{ color: C.inkMuted, marginBottom: 20 }}>
                Подарок за покупку
              </div>
              <h2 className={`${disp} m-0 text-[40px] md:text-[56px] leading-none`}>
                Косметичка
                <br />в подарок
              </h2>
              <p className="text-[17px] leading-[26px] mt-6 mb-9 max-w-[420px]" style={{ color: C.text }}>
                {shownBrands.length > 1
                  ? `Считаем общую сумму ${goods === "косметику" ? "косметики" : "косметики и парфюма"} ${brandsAnd} в заказе. Косметичку выбираете любую — можно заказать ${shownBrands[shownBrands.length - 1].name}, а выбрать ${shownBrands[0].name}.`
                  : `К заказу ${brandLine} на ${THRESHOLD} и больше положим фирменную косметичку — модель выбираете сами.`}
              </p>
              <ol className="list-none p-0 m-0 flex flex-col" style={{ borderTop: `1px solid ${C.line}` }}>
                {[
                  `Добавьте в корзину ${goods} ${brandsAnd}`,
                  `Соберите на ${THRESHOLD} и больше${shownBrands.length > 1 ? " — бренды суммируются" : ""}`,
                  "Выберите одну косметичку ниже — или положим случайную",
                ].map((text, i) => (
                  <li key={text} className="flex gap-5 py-[18px] items-baseline" style={{ borderBottom: `1px solid ${C.line}` }}>
                    <span className={label} style={{ color: C.inkMuted, minWidth: 24 }}>
                      0{i + 1}
                    </span>
                    <span className="text-[16px] leading-6">{text}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-8 max-w-[420px] px-5 py-[18px]" style={{ background: C.cream, border: `1px solid ${C.ink}` }} aria-live="polite">
                {progress === null ? (
                  <div className="text-[14px] leading-5" style={{ color: C.inkMuted }}>
                    Смотрим, что у вас в корзине…
                  </div>
                ) : top ? (
                  <>
                    <div className="flex justify-between gap-3 items-baseline">
                      <span className={label}>В корзине · {top.brands.map((b) => b.name).join(" + ")}</span>
                      <span className={fontMono.className} style={{ fontSize: 15 }}>
                        {formatRub(top.total)}
                      </span>
                    </div>
                    <div
                      className="my-3"
                      style={{ height: 6, background: "#F0D6D2" }}
                      role="progressbar"
                      aria-label="До подарка"
                      aria-valuemin={0}
                      aria-valuemax={BEAUTY_PROMO.threshold}
                      aria-valuenow={Math.min(top.total, BEAUTY_PROMO.threshold)}
                    >
                      <div
                        style={{
                          height: 6,
                          width: `${Math.min(100, (top.total / BEAUTY_PROMO.threshold) * 100)}%`,
                          background: C.accent,
                          transition: "width .6s ease",
                        }}
                      />
                    </div>
                    <div className="text-[14px] leading-5" style={{ color: C.text }}>
                      {top.eligible
                        ? chosenPouch
                          ? `Готово: косметичка ${chosenPouch.brand.name} «${chosenPouch.name}» будет в заказе.`
                          : "Готово: косметичка ваша — выберите модель ниже или положим случайную."
                        : `Добавьте ещё на ${formatRub(top.remaining)}, и косметичка ваша.`}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between gap-3 items-baseline">
                      <span className={label}>В корзине</span>
                      <span className={fontMono.className} style={{ fontSize: 15 }}>
                        0 ₽
                      </span>
                    </div>
                    <div className="my-3" style={{ height: 6, background: "#F0D6D2" }} />
                    <div className="text-[14px] leading-5" style={{ color: C.text }}>
                      Добавьте {goods} {brandsAnd} на {THRESHOLD} в сумме — и косметичка ваша.
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex-[1.15] min-w-0 w-full">
              <PouchCollage pouches={pouches} choice={choice} onChoose={choose} />
              <p className="text-center text-[13px] leading-5 mt-6" style={{ color: C.inkMuted }}>
                Нажмите на косметичку, чтобы выбрать её
              </p>
            </div>
          </div>

          <div id="pouches" className="mt-16 md:mt-24 pt-12 md:pt-16 scroll-mt-20" style={{ borderTop: `1px solid ${C.line}` }}>
            <div className={label} style={{ color: C.inkMuted, marginBottom: 16 }}>
              Ваш подарок
            </div>
            <h2 className={`${disp} m-0 mb-10 md:mb-12 text-[40px] md:text-[56px] leading-none`}>Выберите косметичку</h2>
            <PouchPicker pouches={pouches} choice={choice} onChoose={choose} />
            <p className="text-[13px] leading-5 mt-8 max-w-[640px]" style={{ color: C.inkMuted }}>
              Выбор сохранится в этом браузере и попадёт в заказ при оформлении. Одна косметичка на заказ; если не
              выберете — положим случайную.
            </p>
          </div>
        </div>
      </section>

      {/* ── Каталог ── */}
      <section id="catalog" className="mx-auto max-w-[1280px] px-4 md:px-10 py-14 md:py-[88px] scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
          <div>
            <div className={label} style={{ color: C.inkMuted, marginBottom: 16 }}>
              {maxDiscount >= 5 ? `Скидки до ${maxDiscount}%` : `Подарок от ${THRESHOLD}`}
            </div>
            <h2 className={`${disp} m-0 text-[40px] md:text-[56px] leading-none`}>{hasFragrance ? "Косметика и парфюм" : "Косметика"} {brandLine}</h2>
          </div>
          {brands.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по бренду">
              {[{ key: "all", name: "Все" }, ...brands].map((b) => {
                const on = brandFilter === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setBrandFilter(b.key)}
                    aria-pressed={on}
                    className="min-h-[44px] px-5 rounded-full border text-[14px] font-bold"
                    style={{ borderColor: C.ink, background: on ? C.ink : "transparent", color: on ? C.cream : C.ink }}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {visible.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {visible.map((p) => {
              const src = getOptimizedImageUrl(p.image, { width: 600, quality: 82 });
              const off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
              return (
                <Link key={p.id} href={p.href} className="group flex flex-col min-w-0" style={{ color: C.ink }}>
                  <div className="relative overflow-hidden" style={{ aspectRatio: "4 / 5", background: "#F4ECE8" }}>
                    {src ? (
                      <Image
                        src={src}
                        alt={p.name}
                        fill
                        unoptimized={shouldBypassNextImageOptimization(src)}
                        sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 290px"
                        className="object-contain p-5 transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : null}
                    {off >= 5 && (
                      <div className={`${label} absolute left-0 top-0 px-[10px] py-[6px]`} style={{ background: C.ink, color: C.cream }}>
                        −{off}%
                      </div>
                    )}
                  </div>
                  <div className="pt-3.5 flex flex-col gap-1.5">
                    <div className="text-[15px] sm:text-[17px] leading-[22px] font-bold">{p.name}</div>
                    {p.sub && (
                      <div className="text-[13px] leading-[18px]" style={{ color: C.inkMuted }}>
                        {p.sub}
                      </div>
                    )}
                    <div className="flex gap-2.5 items-baseline flex-wrap mt-1">
                      <span className={fontMono.className} style={{ fontSize: 16, color: C.accent }}>
                        {formatRub(p.price)}
                      </span>
                      {p.oldPrice && (
                        <span className={fontMono.className} style={{ fontSize: 13, color: C.inkMuted, textDecoration: "line-through" }}>
                          {formatRub(p.oldPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-[16px]" style={{ color: C.text }}>
            Косметика скоро появится. Загляните чуть позже или <Link href="/category/cosmetics" className="underline">посмотрите весь раздел</Link>.
          </p>
        )}
      </section>

      {/* ── Условия ── */}
      <section id="terms" style={{ background: C.ink, color: C.cream }}>
        <div className="mx-auto max-w-[1280px] px-4 md:px-10 py-14 md:py-[72px]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-12">
            <div className="max-w-[560px]">
              <div className={label} style={{ color: C.line, marginBottom: 20 }}>
                Заказ
              </div>
              <h2 className={`${fontDisplay.className} uppercase m-0 text-[34px] md:text-[44px] leading-[1.02]`}>
                Соберите заказ на {THRESHOLD} и получите косметичку
              </h2>
            </div>
            <Link href="/cart" className={btn} style={{ background: C.cream, color: C.ink, borderColor: C.cream, flex: "none" }}>
              Перейти в корзину
            </Link>
          </div>
          <div className="mt-12 pt-6 flex flex-wrap gap-6 justify-between" style={{ borderTop: "1px solid #4A3B3D" }}>
            <div className="text-[13px] leading-5 max-w-[640px]" style={{ color: C.line }}>
              {ends ? `Акция действует ${ends}. ` : ""}Подарок добавляется к заказу, в котором косметики и парфюма {brandsAnd} в
              сумме на {THRESHOLD} и больше (бренды суммируются). Одна косметичка на заказ, любого бренда — модель вы
              выбираете на этой странице, не выбрали — положим случайную.
            </div>
            <div className={label} style={{ color: C.line }}>
              Stage Store · Москва
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
