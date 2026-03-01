"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

type ConciergeState = "idle" | "sending" | "success" | "error";

export default function NotFoundPage() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<ConciergeState>("idle");

  const submitConcierge = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contact.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Гость 404",
          contact: contact.trim(),
          notes: notes.trim() || "Запрос с 404 страницы",
          source: "404-page",
          category: "Не найдена страница",
        }),
      });
      if (!res.ok) throw new Error("bad-status");
      setState("success");
      setNotes("");
    } catch {
      setState("error");
    }
  };

  return (
    <main className="relative min-h-[78vh] overflow-hidden px-4 py-10 sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-16 h-72 w-72 rounded-full bg-[#1d4ed8]/20 blur-3xl" />
        <div className="absolute right-[-8%] top-[20%] h-80 w-80 rounded-full bg-[#f97316]/15 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[28%] h-80 w-80 rounded-full bg-[#0f172a]/12 blur-3xl" />
      </div>

      <section className="relative mx-auto grid w-full max-w-[1160px] gap-6 rounded-[34px] border border-black/10 bg-white/90 p-5 shadow-[0_22px_80px_rgba(0,0,0,0.09)] backdrop-blur sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[26px] border border-black/10 bg-gradient-to-br from-white via-[#f8fafc] to-[#eef2ff] p-6 sm:p-8">
          <div className="inline-flex rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/70">
            Error 404
          </div>
          <h1 className="mt-4 text-4xl font-black leading-[0.95] tracking-tight text-black sm:text-6xl">
            Страница
            <br />
            не найдена
          </h1>
          <p className="mt-4 max-w-[56ch] text-sm text-black/65 sm:text-base">
            Похоже, ссылка устарела или адрес был введен с ошибкой. Вернись в каталог или оставь заявку
            консьержу — поможем найти нужный товар вручную.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-black px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black/90"
            >
              Вернуться в каталог
            </Link>
            <Link
              href="#concierge"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-black/15 bg-white px-6 text-sm font-semibold text-black/80 transition hover:border-black/30"
            >
              Консьерж-сервис
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:max-w-[420px]">
            <div className="rounded-2xl border border-black/10 bg-white p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-black/45">Навигация</div>
              <div className="mt-1 text-sm font-semibold">Каталог и подборки</div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-black/45">Поддержка</div>
              <div className="mt-1 text-sm font-semibold">Консьерж-сервис 24/7</div>
            </div>
          </div>
        </div>

        <div id="concierge" className="rounded-[26px] border border-black/10 bg-[#0f172a] p-6 text-white sm:p-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Консьерж</div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Оставить быстрый запрос</h2>
          <p className="mt-2 text-sm text-white/70">
            Напиши, что ищешь. Консьерж свяжется с тобой и предложит релевантные варианты.
          </p>

          <form className="mt-5 space-y-3" onSubmit={submitConcierge}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Имя (необязательно)"
              className="h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/45"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Telegram / телефон / email"
              className="h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/45"
              required
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Что ищете? Бренд, категория, бюджет, размер..."
              className="min-h-[108px] w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/45"
            />

            <button
              type="submit"
              disabled={state === "sending"}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "sending" ? "Отправляем..." : "Отправить в консьерж"}
            </button>
          </form>

          {state === "success" ? (
            <p className="mt-3 text-sm text-emerald-300">Запрос отправлен. Консьерж скоро свяжется с вами.</p>
          ) : null}
          {state === "error" ? (
            <p className="mt-3 text-sm text-rose-300">Не удалось отправить запрос. Попробуйте еще раз.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
