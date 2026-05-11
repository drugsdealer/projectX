"use client";

import { useEffect, useState } from "react";

import YandexMetrika from "@/components/YandexMetrika";
import { useUser } from "@/user/UserContext";
import { canUseOptionalClientData, PRIVACY_CONSENT_EVENT } from "@/lib/privacy-consent";

export function ConsentAwareYandexMetrika() {
  const { user } = useUser();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(Boolean(user?.id) || canUseOptionalClientData());
    sync();
    window.addEventListener(PRIVACY_CONSENT_EVENT, sync);
    window.addEventListener("auth:changed", sync);
    return () => {
      window.removeEventListener(PRIVACY_CONSENT_EVENT, sync);
      window.removeEventListener("auth:changed", sync);
    };
  }, [user?.id]);

  if (!allowed) return null;
  return <YandexMetrika />;
}
