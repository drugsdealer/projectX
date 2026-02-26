"use client";

import { useEffect } from "react";

export default function AdminSessionGuard() {
  useEffect(() => {
    const clear2FA = () => {
      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon("/api/admin/2fa/clear");
          return;
        }
        fetch("/api/admin/2fa/clear", { method: "POST", keepalive: true, credentials: "include" });
      } catch {}
    };

    window.addEventListener("pagehide", clear2FA);
    return () => {
      window.removeEventListener("pagehide", clear2FA);
    };
  }, []);

  return null;
}
