"use client";

import { useEffect } from "react";

export default function AdminSessionGuard() {
  // 2FA is cleared only by explicit admin exit/logout or by cookie expiry.
  // Clearing it on navigation caused false Unauthorized states during admin redirects.
  return null;
}
