"use client";

import { useEffect } from "react";

export default function AdminSessionGuard() {
  useEffect(() => {
    return () => {
      try {
        fetch("/api/admin/2fa/clear", { method: "POST", keepalive: true });
      } catch {}
    };
  }, []);

  return null;
}
