"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

/*
  Формирование оплаты. Создаёт платёж в банке и сразу уводит на защищённую
  страницу Т-Банка. Если банк или сеть подвели — честно говорим, что это
  временная ошибка, и даём сформировать оплату заново. Заказ при этом
  сохраняется, деньги не списываются.
*/

type Phase = "forming" | "redirecting" | "error";

const STEPS = ["Создаём платёж", "Связываемся с банком", "Открываем страницу оплаты"];

export default function PayClient() {
  const router = useRouter();
  const search = useSearchParams();
  const orderId = Number(search.get("orderId"));

  const [phase, setPhase] = useState<Phase>("forming");
  const [step, setStep] = useState(0);
  const [errorText, setErrorText] = useState<string>("");
  const [canRetry, setCanRetry] = useState(true);
  const started = useRef(false);

  const form = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setPhase("error");
      setCanRetry(false);
      setErrorText("Не удалось определить заказ. Вернитесь в корзину и оформите его заново.");
      return;
    }

    setPhase("forming");
    setErrorText("");
    setStep(0);
    // Шаги идут сами, пока ждём банк: человек видит, что процесс идёт
    const t1 = setTimeout(() => setStep(1), 700);

    try {
      const res = await fetch("/api/tbank/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({} as any));
      clearTimeout(t1);

      if (res.ok && data?.success && data?.paymentUrl) {
        setStep(2);
        setPhase("redirecting");
        window.location.href = data.paymentUrl;
        return;
      }

      const msg = String(data?.message || "");
      if (/уже оплачен/i.test(msg)) {
        router.replace(`/payment/result?orderId=${orderId}`);
        return;
      }
      if (res.status === 404 || res.status === 403) {
        setCanRetry(false);
        setErrorText("Этот заказ не найден в вашем аккаунте. Проверьте, что вы вошли под тем же профилем.");
      } else if (res.status === 401) {
        setCanRetry(false);
        setErrorText("Сессия истекла. Войдите в аккаунт и оплатите заказ из истории заказов.");
      } else {
        setCanRetry(true);
        setErrorText("Банк не ответил вовремя. Это временная ошибка — попробуйте сформировать оплату ещё раз.");
      }
      console.error("[pay] не удалось создать платёж:", res.status, msg);
      setPhase("error");
    } catch {
      clearTimeout(t1);
      setCanRetry(true);
      setErrorText("Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.");
      setPhase("error");
    }
  }, [orderId, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    form();
  }, [form]);

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {phase !== "error" ? (
            <motion.div
              key="forming"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="rounded-3xl border border-black/10 bg-white p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.10)] sm:p-10"
            >
              <div className="mx-auto h-11 w-11 animate-spin rounded-full border-2 border-black/10 border-t-black" />
              <h1 className="mt-6 text-2xl font-extrabold tracking-[-0.03em]">Формируем оплату</h1>
              <p className="mt-2 text-sm text-black/50">Это займёт несколько секунд. Не закрывайте страницу.</p>

              <ol className="mx-auto mt-7 max-w-[260px] space-y-3 text-left">
                {STEPS.map((label, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <li key={label} className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors duration-300 ${
                          done
                            ? "border-black bg-black text-white"
                            : active
                            ? "border-black text-black"
                            : "border-black/15 text-transparent"
                        }`}
                      >
                        {done ? "✓" : active ? <span className="h-1.5 w-1.5 rounded-full bg-black" /> : ""}
                      </span>
                      <span className={`transition-colors duration-300 ${done || active ? "text-black" : "text-black/35"}`}>
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <p className="mt-8 text-xs leading-relaxed text-black/40">
                Оплата картой или через СБП на защищённой странице Т-Банка.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="rounded-3xl border border-black/10 bg-white p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.10)] sm:p-10"
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-black/15 text-lg text-black/50">
                !
              </div>
              <h1 className="mt-6 text-2xl font-extrabold tracking-[-0.03em]">Не получилось сформировать оплату</h1>
              <p className="mt-3 text-sm leading-relaxed text-black/55">{errorText}</p>
              <p className="mt-2 text-xs text-black/40">Заказ сохранён, деньги не списывались.</p>

              <div className="mt-8 flex flex-col gap-3">
                {canRetry && (
                  <button
                    type="button"
                    onClick={form}
                    className="group w-full rounded-2xl bg-black px-6 py-4 text-base font-bold text-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.25)] active:translate-y-0"
                  >
                    Сформировать оплату ещё раз
                    <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </button>
                )}
                <Link
                  href="/user?tab=orders"
                  className="w-full rounded-2xl border border-black/15 px-6 py-3.5 text-sm font-semibold text-black/70 transition hover:border-black/40 hover:text-black"
                >
                  Мои заказы
                </Link>
              </div>

              <p className="mt-6 text-xs text-black/40">
                Не получается несколько раз подряд? Напишите нам в Telegram{" "}
                <a href="https://t.me/stagestore" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  @stagestore
                </a>
                {orderId > 0 ? <> — укажите номер заказа {orderId}.</> : "."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
