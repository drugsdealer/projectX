"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { COMPANY } from "@/lib/company";

/* Три шага вместо длинной формы: человек отвечает на один вопрос за раз,
   а справа видит, что именно уйдёт менеджеру. */

const CATEGORIES = ["Обувь", "Одежда", "Сумки", "Аксессуары", "Парфюмерия", "Головные уборы"];

const BRANDS = [
  "Rick Owens", "Maison Margiela", "Comme des Garçons", "Stone Island",
  "Maison Mihara Yasuhiro", "Y-3", "Golden Goose", "Onitsuka Tiger", "Carhartt WIP",
];

const BUDGETS = ["до 50 000 ₽", "50–150 000 ₽", "150–300 000 ₽", "от 300 000 ₽", "не ограничен"];
const TIMINGS = ["Не спешу", "В течение месяца", "Как можно скорее"];

const STEPS = ["Что ищете", "Детали", "Контакты"] as const;

export default function ConciergeClient() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [item, setItem] = useState("");
  const [size, setSize] = useState("");
  const [budget, setBudget] = useState("");
  const [timing, setTiming] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(category || brand.trim() || item.trim());
    if (step === 1) return true;
    return Boolean(name.trim() && contact.trim());
  }, [step, category, brand, item, name, contact]);

  const summary = useMemo(
    () =>
      [
        category && { k: "Категория", v: category },
        brand.trim() && { k: "Бренд", v: brand.trim() },
        item.trim() && { k: "Что именно", v: item.trim() },
        size.trim() && { k: "Размер", v: size.trim() },
        budget && { k: "Бюджет", v: budget },
        timing && { k: "Сроки", v: timing },
        name.trim() && { k: "Имя", v: name.trim() },
        contact.trim() && { k: "Связь", v: contact.trim() },
      ].filter(Boolean) as { k: string; v: string }[],
    [category, brand, item, size, budget, timing, name, contact]
  );

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const notes = [
        item.trim() && `Что именно: ${item.trim()}`,
        budget && `Бюджет: ${budget}`,
        timing && `Сроки: ${timing}`,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          category: [category, brand.trim()].filter(Boolean).join(" · "),
          size: size.trim(),
          notes,
          source: "Страница консьержа",
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("Не удалось отправить. Попробуйте ещё раз или напишите нам в Telegram.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white">
      {/* мягкое свечение вместо плоского чёрного — глубина без пестроты */}
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-white/[0.04] blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-white/50 transition-colors hover:text-white"
        >
          ← На главную
        </Link>

        <header className="mt-8 sm:mt-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
            Личный подбор
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
            Консьерж-
            <br className="hidden sm:block" />
            сервис
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
            Ищете конкретную вещь, редкий размер или архивную позицию? Опишите запрос —
            найдём, проверим подлинность и привезём под вас.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-xs text-white/45">
            <span>Двойная проверка подлинности</span>
            <span className="hidden sm:inline text-white/20">·</span>
            <span>Оферта и условия возврата прописаны</span>
            <span className="hidden sm:inline text-white/20">·</span>
            <span>Отвечаем в течение рабочего дня</span>
          </div>
        </header>

        <div className="mt-10 grid gap-8 sm:mt-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <section>
            {done ? (
              <Done />
            ) : (
              <>
                <Progress step={step} />

                <div className="mt-8 min-h-[320px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                    >
                      {step === 0 && (
                        <div className="space-y-8">
                          <Field label="Категория">
                            <Chips options={CATEGORIES} value={category} onChange={setCategory} />
                          </Field>
                          <Field label="Бренд" hint="можно выбрать или вписать свой">
                            <Chips options={BRANDS} value={brand} onChange={setBrand} />
                            <Input
                              value={brand}
                              onChange={setBrand}
                              placeholder="Например, Bottega Veneta"
                              className="mt-3"
                            />
                          </Field>
                          <Field label="Что именно ищете">
                            <Textarea
                              value={item}
                              onChange={setItem}
                              placeholder="Модель, цвет, ссылка на референс — что угодно, что поможет найти"
                            />
                          </Field>
                        </div>
                      )}

                      {step === 1 && (
                        <div className="space-y-8">
                          <Field label="Размер" hint="если знаете">
                            <Input value={size} onChange={setSize} placeholder="EU 43, M, One size" />
                          </Field>
                          <Field label="Ориентир по бюджету">
                            <Chips options={BUDGETS} value={budget} onChange={setBudget} />
                          </Field>
                          <Field label="Сроки">
                            <Chips options={TIMINGS} value={timing} onChange={setTiming} />
                          </Field>
                        </div>
                      )}

                      {step === 2 && (
                        <div className="space-y-8">
                          <Field label="Как к вам обращаться">
                            <Input value={name} onChange={setName} placeholder="Имя" />
                          </Field>
                          <Field label="Как связаться">
                            <Input
                              value={contact}
                              onChange={setContact}
                              placeholder="Телефон, @telegram или почта"
                            />
                          </Field>
                          <p className="text-xs leading-relaxed text-white/40">
                            Отвечаем в течение рабочего дня. Данные используем только для
                            обработки вашего запроса.
                          </p>
                          {error && <p className="text-xs text-red-400">{error}</p>}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="mt-10 flex items-center gap-3">
                  {step > 0 && (
                    <button
                      onClick={() => setStep((s) => s - 1)}
                      className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/40 hover:text-white"
                    >
                      Назад
                    </button>
                  )}
                  {step < 2 ? (
                    <button
                      onClick={() => setStep((s) => s + 1)}
                      disabled={!canNext}
                      className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition-opacity disabled:opacity-30"
                    >
                      Далее
                    </button>
                  ) : (
                    <button
                      onClick={submit}
                      disabled={!canNext || sending}
                      className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition-opacity disabled:opacity-30"
                    >
                      {sending ? "Отправляем…" : "Отправить запрос"}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          {!done && <Summary items={summary} />}
        </div>

        <Process />
        <Why />
        <Examples />
        <Faq />

        <p className="mt-16 border-t border-white/10 pt-8 text-xs leading-relaxed text-white/30">
          {COMPANY.legalName} · ОГРНИП {COMPANY.ogrnip} · ИНН {COMPANY.inn}
          <br />
          Запрос ни к чему не обязывает: условия и цену согласуем до оплаты.
        </p>
      </div>
    </main>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8">
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{title}</h2>
    </div>
  );
}

/* Цепочка проверки — та же, что на премиум-странице: вещь смотрят дважды,
   до отправки и после прибытия в Россию. */
const PROCESS = [
  { n: "01", t: "Запрос", d: "Вы описываете вещь. Чем больше деталей — модель, цвет, ссылка на референс, — тем точнее поиск." },
  { n: "02", t: "Поиск и варианты", d: "Проверяем наличие у байеров и на закрытых площадках. Присылаем варианты с ценой и сроком." },
  { n: "03", t: "Проверка подлинности", d: "Эксперты смотрят вещь при выкупе, затем повторно после прибытия в Россию: материалы, фурнитура, прошивка, комплектация." },
  { n: "04", t: "Доставка", d: "Привозим в фирменной упаковке с индивидуальной пломбой. Вручение под подпись." },
];

function Process() {
  return (
    <section className="mt-24 sm:mt-32">
      <SectionTitle eyebrow="Порядок работы" title="Как проходит запрос" />
      <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {PROCESS.map((s) => (
          <div key={s.n} className="bg-[#0a0a0b] p-6 sm:p-7">
            <div className="text-xs font-semibold tracking-[0.2em] text-white/30">{s.n}</div>
            <div className="mt-4 text-base font-bold">{s.t}</div>
            <p className="mt-3 text-sm leading-relaxed text-white/50">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const WHY = [
  { t: "Доступ, которого нет в рознице", d: "Архивные позиции, редкие размеры, вещи с уже закрытых дропов — то, чего не найти на витрине." },
  { t: "Вещь смотрят дважды", d: "Проверка при выкупе и повторная экспертиза после прибытия в Россию — до того, как вещь окажется у вас." },
  { t: "Понятные обязательства", d: "Цена, сроки и условия возврата фиксируются до оплаты. Никаких договорённостей на словах." },
];

function Why() {
  return (
    <section className="mt-24 sm:mt-32">
      <SectionTitle eyebrow="Почему через нас" title="За что здесь платят" />
      <div className="grid gap-4 sm:grid-cols-3">
        {WHY.map((w) => (
          <div key={w.t} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
            <div className="text-base font-bold leading-snug">{w.t}</div>
            <p className="mt-3 text-sm leading-relaxed text-white/50">{w.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const EXAMPLES = [
  "Ищу Rick Owens Geobasket, 43 EU, чёрные",
  "Нужен пуховик Moncler, размер 2, бюджет до 180 000 ₽",
  "Ищу Louis Vuitton Keepall 45, состояние не ниже 8/10",
  "Maison Margiela Tabi, 39, любой цвет кроме белого",
  "Парфюм Baccarat Rouge 540, 70 мл",
  "Stone Island куртка, размер L, тёмная",
];

function Examples() {
  return (
    <section className="mt-24 sm:mt-32">
      <SectionTitle eyebrow="Живые запросы" title="С чем к нам приходят" />
      <div className="flex flex-wrap gap-2.5">
        {EXAMPLES.map((e) => (
          <span
            key={e}
            className="rounded-full border border-white/12 bg-white/[0.03] px-4 py-2.5 text-sm text-white/60"
          >
            {e}
          </span>
        ))}
      </div>
    </section>
  );
}

const FAQ = [
  { q: "Сколько ждать ответа?", a: "Менеджер пишет в течение рабочего дня. Варианты с ценой обычно приходят за один–три дня — зависит от того, насколько редкая вещь." },
  { q: "Когда нужно платить?", a: "После того как вы согласуете конкретный вариант и цену. Сам запрос бесплатный и ни к чему не обязывает." },
  { q: "А если вещь не найдётся?", a: "Скажем честно и предложим близкие альтернативы. Никаких списаний за неудачный поиск." },
  { q: "Как убедиться в подлинности?", a: "Вещь проходит проверку дважды — при выкупе и после прибытия в Россию. Показываем фото и детали на каждом этапе." },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mt-24 sm:mt-32">
      <SectionTitle eyebrow="Вопросы" title="Коротко о главном" />
      <div className="divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10">
        {FAQ.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span className="text-sm font-semibold sm:text-base">{f.q}</span>
                <span
                  className={`shrink-0 text-lg text-white/40 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                >
                  +
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm leading-relaxed text-white/50">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-3">
          <div className="flex-1">
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-white"
                initial={false}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.35 }}
              />
            </div>
            <div
              className={`mt-2 text-[10px] uppercase tracking-[0.2em] transition-colors ${
                i <= step ? "text-white/80" : "text-white/30"
              }`}
            >
              {label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        {hint && <span className="text-xs text-white/35">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(active ? "" : o)}
            className={`rounded-full border px-4 py-2 text-sm transition-all ${
              active
                ? "border-white bg-white text-black font-semibold"
                : "border-white/20 text-white/70 hover:border-white/50 hover:text-white"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/45 ${className}`}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full resize-none rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/45"
    />
  );
}

function Summary({ items }: { items: { k: string; v: string }[] }) {
  return (
    <aside className="lg:sticky lg:top-10 lg:h-fit">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
          Ваш запрос
        </div>
        {items.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-white/40">
            Заполняйте поля — здесь появится то, что уйдёт менеджеру.
          </p>
        ) : (
          <dl className="mt-5 space-y-4">
            {items.map((it) => (
              <motion.div
                key={it.k}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <dt className="text-[11px] uppercase tracking-[0.14em] text-white/35">{it.k}</dt>
                <dd className="mt-1 break-words text-sm text-white/90">{it.v}</dd>
              </motion.div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-sm font-semibold">Как это работает</div>
        <ol className="mt-4 space-y-3 text-sm text-white/55">
          <li>1. Вы описываете, что нужно</li>
          <li>2. Мы ищем и присылаем варианты с ценой</li>
          <li>3. Проверяем подлинность и привозим</li>
        </ol>
      </div>
    </aside>
  );
}

function Done() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-12"
    >
      <div className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Запрос принят</div>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
        Менеджер свяжется с вами в течение рабочего дня. Если нужно быстрее — напишите
        напрямую в Telegram.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="https://t.me/stagestore"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-white px-7 py-3 text-sm font-bold text-black"
        >
          Написать в Telegram
        </a>
        <Link
          href="/"
          className="rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/40 hover:text-white"
        >
          Вернуться в магазин
        </Link>
      </div>
    </motion.div>
  );
}
