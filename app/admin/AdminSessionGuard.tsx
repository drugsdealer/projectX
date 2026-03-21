"use client";

import { useEffect } from "react";

export default function AdminSessionGuard() {
  // Cookie clearing is handled by middleware (clears admin_2fa_ok on non-admin navigation).
  // The cookie is also a session cookie, so it expires when the browser closes.
  // Previously this component cleared the cookie on pagehide, but that caused issues:
  // navigating within admin (e.g. from /admin/2fa to /admin) triggered pagehide,
  // which cleared the cookie before the destination page could load.
  return null;
}
