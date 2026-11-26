"use client";

import { useEffect, useState } from "react";

import YandexMetrika from "@/components/YandexMetrika";
import { canUseOptionalClientData, PRIVACY_CONSENT_EVENT } from "@/lib/privacy-consent";

export function ConsentAwareYandexMetrika() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(canUseOptionalClientData());
    sync();
    window.addEventListener(PRIVACY_CONSENT_EVENT, sync);
    window.addEventListener("auth:changed", sync);
    return () => {
      window.removeEventListener(PRIVACY_CONSENT_EVENT, sync);
      window.removeEventListener("auth:changed", sync);
    };
  }, []);

  // На тестовом сайте Метрику не грузим — наши проверки не должны попадать в статистику.
  if (!allowed || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") return null;
  return <YandexMetrika />;
}
