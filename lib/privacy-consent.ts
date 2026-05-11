export type PrivacyConsentValue = "accepted" | "declined";

export const PRIVACY_CONSENT_KEY = "stage_privacy_consent_v1";
export const PRIVACY_CONSENT_EVENT = "stage:privacy-consent-changed";

function safeLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/([.$?*|{}()\[\]\\/+^])/g, "\\$1");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function getStoredPrivacyConsent(): PrivacyConsentValue | null {
  const local = safeLocalStorage()?.getItem(PRIVACY_CONSENT_KEY);
  const value = local || readCookie(PRIVACY_CONSENT_KEY);
  return value === "accepted" || value === "declined" ? value : null;
}

export function setStoredPrivacyConsent(value: PrivacyConsentValue) {
  safeLocalStorage()?.setItem(PRIVACY_CONSENT_KEY, value);
  writeCookie(PRIVACY_CONSENT_KEY, value, 60 * 60 * 24 * 180);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PRIVACY_CONSENT_EVENT, { detail: value }));
  }
}

export function hasClientAccountSession() {
  if (typeof window === "undefined") return false;

  const storage = safeLocalStorage();
  const cachedUser = storage?.getItem("ui_user_data");
  if (cachedUser) {
    try {
      const parsed = JSON.parse(cachedUser);
      if (parsed?.id || parsed?.email || parsed?.phone) return true;
    } catch {
      return true;
    }
  }

  return Boolean(
    readCookie("ui_user_data") ||
    readCookie("ui_user_id") ||
    readCookie("session_user_id") ||
    readCookie("auth_user_id")
  );
}

export function canUseOptionalClientData() {
  return hasClientAccountSession() || getStoredPrivacyConsent() === "accepted";
}
