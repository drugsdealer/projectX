"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useUser } from "@/user/UserContext";
import {
  canUseOptionalClientData,
  getStoredPrivacyConsent,
  PRIVACY_CONSENT_EVENT,
  setStoredPrivacyConsent,
  type PrivacyConsentValue,
} from "@/lib/privacy-consent";

export function PrivacyConsentBanner() {
  const { user } = useUser();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (user?.id) {
        setVisible(false);
        return;
      }
      setVisible(!getStoredPrivacyConsent() && !canUseOptionalClientData());
    };

    sync();
    window.addEventListener(PRIVACY_CONSENT_EVENT, sync);
    window.addEventListener("auth:changed", sync);
    return () => {
      window.removeEventListener(PRIVACY_CONSENT_EVENT, sync);
      window.removeEventListener("auth:changed", sync);
    };
  }, [user?.id]);

  const choose = (value: PrivacyConsentValue) => {
    setStoredPrivacyConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <section
      aria-label="Согласие на обработку данных и cookies"
      className="fixed inset-x-3 bottom-3 z-[10000] mx-auto max-w-5xl sm:bottom-5"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-black/10 bg-white/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#f2d2a0]/40 blur-2xl" />
        <div className="absolute -bottom-16 left-12 h-36 w-36 rounded-full bg-black/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-2xl shadow-lg sm:h-14 sm:w-14">
              🍪
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-black/45">
                Конфиденциальность
              </div>
              <h2 className="mt-1 text-lg font-extrabold leading-tight text-black sm:text-xl">
                Разрешить обработку cookies и данных для улучшения сайта?
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/62">
                Технические cookies нужны для корзины, авторизации и безопасности. Аналитику,
                историю действий и персональные рекомендации мы включаем только после вашего
                согласия. Если отказаться, сайт продолжит работать, но без необязательного
                отслеживания.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-black/50">
                <Link href="/privacy" className="underline underline-offset-4 hover:text-black">
                  Политика конфиденциальности
                </Link>
                <span>·</span>
                <Link href="/personal-data" className="underline underline-offset-4 hover:text-black">
                  Персональные данные
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <button
              type="button"
              onClick={() => choose("declined")}
              className="h-11 rounded-full border border-black/15 bg-white px-4 text-sm font-bold text-black/70 transition hover:border-black/40 hover:text-black"
            >
              Отказаться
            </button>
            <button
              type="button"
              onClick={() => choose("accepted")}
              className="h-11 rounded-full bg-black px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5"
            >
              Согласен
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
