"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";


function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function readCookieJSON<T = any>(name: string): T | null {
  try {
    const v = readCookie(name);
    if (!v) return null;
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

const PLACEHOLDER_NAME = "Введите ФИО";
const LEGACY_PLACEHOLDER_NAME = "Не указано";
const isPlaceholderName = (v?: string | null) =>
  !v || v === PLACEHOLDER_NAME || v === LEGACY_PLACEHOLDER_NAME;

// Helper: pick display name from various sources
function pickDisplayName(src: any): string {
  if (!src) return PLACEHOLDER_NAME;
  const raw = (src.name ?? src.fullName ?? "").toString().trim();
  if (raw && !isPlaceholderName(raw)) return raw;
  const ln = (src.lastName ?? src.surname ?? "").toString().trim();
  const fn = (src.firstName ?? src.givenName ?? "").toString().trim();
  const combo = [ln, fn].filter(Boolean).join(" ");
  return combo || PLACEHOLDER_NAME;
}

function normalizeVerified(value: any): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (value instanceof Date) return value.getTime() > 0;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (!raw || raw === "false" || raw === "0" || raw === "null") return false;
    const ts = Date.parse(raw);
    if (Number.isFinite(ts)) return ts > 0;
    return raw === "true";
  }
  return false;
}

function buildUserFromLoose(src: any): User | null {
  if (!src) return null;
  const verified = normalizeVerified(src.verified ?? src.confirmed ?? src.verifiedAt);
  const u: User = {
    id: src.id ?? undefined,
    name: pickDisplayName(src),
    fullName: src.fullName ?? undefined,
    email: src.email ?? undefined,
    phone: src.phone ?? undefined,
    isGuest: false,
    verified,
    confirmed: verified,
    address: src.address ?? undefined,
    gender: src.gender ?? undefined,
    birthDate: src.birthDate ? new Date(src.birthDate).toISOString() : undefined,
    city: src.city ?? undefined,
  };
  return u;
}

function mergeUser(prev: User | null, incoming: User | null): User | null {
  if (!prev && !incoming) return null;
  if (!prev) return incoming;
  if (!incoming) return prev;
  const result: any = { ...prev };
  (Object.keys(incoming) as (keyof User)[]).forEach((k) => {
    const v = (incoming as any)[k];
    if (v !== undefined && v !== null && v !== '') {
      result[k] = v;
    }
  });
  // пересчитать отображаемое имя
  result.name = pickDisplayName(result);
  return result as User;
}

export interface User {
  id?: string;
  name: string;
  fullName?: string;
  email?: string;
  phone?: string;
  isGuest: boolean;
  emailOrPhone?: string;
  password?: string;
  verified?: boolean;
  contact?: string;
  method?: "email" | "phone";
  confirmed?: boolean;
  address?: string;
  gender?: string;
  birthDate?: string;
  city?: string;
}

interface UserContextType {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  login: (userData: any) => void;
  logout: () => Promise<void>;
  updateUser: (updatedData: Partial<User>) => void;
  refresh: () => Promise<void>;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  // Keep a stable ref to the latest user so refresh() always merges against current state
  const userRef = useRef<User | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const clearCachedAuth = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem('ui_user_data');
      localStorage.removeItem('ui_profile_fullName');
    } catch {}
    try {
      document.cookie = 'ui_user_data=; Path=/; Max-Age=0; SameSite=Lax';
      document.cookie = 'ui_fullname=; Path=/; Max-Age=0; SameSite=Lax';
      document.cookie = 'ui_user_id=; Path=/; Max-Age=0; SameSite=Lax';
      document.cookie = 'ui_user_email=; Path=/; Max-Age=0; SameSite=Lax';
      document.cookie = 'ui_user_fullName=; Path=/; Max-Age=0; SameSite=Lax';
    } catch {}
  }, []);

  // Refresh function to fetch user profile from server
  // Wrapped in useCallback with empty deps so event listeners always call the latest version via ref
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        clearCachedAuth();
        return;
      }
      const serverAnswered = Boolean(res?.ok) && data?.success === true;

      const serverUser = data?.success && data?.user
        ? buildUserFromLoose(data.user)
        : null;

      // Важный кейс для production: сервер явно говорит, что сессии нет.
      // Не оставляем "фантомный" профиль из localStorage/cookie.
      if (serverAnswered && !serverUser) {
        clearCachedAuth();
        return;
      }

      // берём базу из текущего стейта, затем из LS, затем из cookie
      let base: User | null = userRef.current;
      if (!base) {
        try {
          const ls = localStorage.getItem('ui_user_data');
          if (ls) base = buildUserFromLoose(JSON.parse(ls)) || JSON.parse(ls);
        } catch {}
      }
      if (!base) {
        const ck = readCookieJSON('ui_user_data');
        if (ck) base = buildUserFromLoose(ck) || (ck as any);
      }

      const merged = mergeUser(base, serverUser);
      if (merged) {
        setUser(merged);
        try {
          localStorage.setItem('ui_user_data', JSON.stringify(merged));
          document.cookie = `ui_user_data=${encodeURIComponent(JSON.stringify(merged))}; Path=/; SameSite=Lax`;
          document.cookie = `ui_fullname=${encodeURIComponent(merged.name || '')}; Path=/; SameSite=Lax`;
        } catch {}
        return;
      }

      // если сервер ничего не вернул и базы нет — попробуем cookie напрямую
      const cookieUser = readCookieJSON('ui_user_data');
      if (cookieUser) {
        const u = buildUserFromLoose(cookieUser) || (cookieUser as any);
        if (u) {
          setUser(u);
          try { localStorage.setItem('ui_user_data', JSON.stringify(u)); } catch {}
        }
      }
    } catch {
      // сеть легла — не трогаем текущее состояние, максимум подхват из cookie
      const cookieUser = readCookieJSON('ui_user_data');
      if (cookieUser) {
        const u = buildUserFromLoose(cookieUser) || (cookieUser as any);
        if (u) {
          setUser(u);
          try { localStorage.setItem('ui_user_data', JSON.stringify(u)); } catch {}
        }
      }
    }
  }, [clearCachedAuth]);

  useEffect(() => {
    let cancelled = false;
    // 1) Hydrate from localStorage
    try {
      const cachedUser = localStorage.getItem('ui_user_data');
      if (cachedUser) {
        const parsed = JSON.parse(cachedUser);
        const normalized = buildUserFromLoose(parsed) || parsed;
        if (!cancelled) setUser(normalized);
      } else {
        // 1b) Fallback to cookie if LS empty
        const cookieUser = readCookieJSON('ui_user_data');
        if (cookieUser && !cancelled) {
          const u = buildUserFromLoose(cookieUser);
          if (u) {
            setUser(u);
            try { localStorage.setItem('ui_user_data', JSON.stringify(u)); } catch {}
          }
        }
      }
    } catch {}
    // 2) Then attempt server refresh; on failure, keep cached user
    (async () => {
      await refresh();
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  // Listen for auth:changed event to refresh user
  useEffect(() => {
    const handler = () => {
      refresh();
    };
    window.addEventListener("auth:changed", handler);
    return () => {
      window.removeEventListener("auth:changed", handler);
    };
  }, [refresh]);

  // Keep auth state honest across devices. When password change or session revoke happens
  // elsewhere, /api/auth/me returns user:null and we clear the cached profile without reload.
  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const check = async () => {
      if (stopped || inFlight || !userRef.current) return;
      if (document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        await refresh();
      } finally {
        inFlight = false;
      }
    };
    const interval = window.setInterval(check, 2000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [refresh]);

  // Listen for profile:updated (from profile form) to refresh cached user name quickly
  useEffect(() => {
    const onProfileUpdated = (e: any) => {
      const detail = e?.detail || {};
      const nextName =
        pickDisplayName(detail) ||
        pickDisplayName(detail.profile) ||
        pickDisplayName(detail.data);
      if (!nextName || nextName === "Не указано") return;
      setUser((prev) => {
        const updated = prev ? { ...prev, name: nextName } : prev;
        try {
          if (updated) localStorage.setItem("ui_user_data", JSON.stringify(updated));
        } catch {}
        return updated;
      });
      try {
        localStorage.setItem("ui_profile_fullName", JSON.stringify({ name: nextName }));
      } catch {}
    };
    window.addEventListener("profile:updated", onProfileUpdated as EventListener);
    return () =>
      window.removeEventListener("profile:updated", onProfileUpdated as EventListener);
  }, []);

  useEffect(() => {
    if (user && isPlaceholderName(user.name)) {
      try {
        const cached = JSON.parse(localStorage.getItem("ui_profile_fullName") || "null");
        if (cached?.name)
          setUser((prev) => (prev ? { ...prev, name: cached.name } : prev));
      } catch {}
    }
  }, [user]);

  const login = (userData: any) => {
    const email =
      userData.email ??
      (userData.method === "email" ? userData.contact : undefined);
    const phone =
      userData.phone ??
      (userData.method === "phone" ? userData.contact : undefined);

    const next: User = {
      id: userData.id,
      name: pickDisplayName(userData),
      fullName: userData.fullName ?? undefined,
      email,
      phone,
      isGuest: false,
      verified: normalizeVerified(userData.verified ?? userData.confirmed ?? userData.verifiedAt),
      confirmed: normalizeVerified(userData.verified ?? userData.confirmed ?? userData.verifiedAt),
      address: userData.address,
      gender: userData.gender,
      birthDate: userData.birthDate,
      city: userData.city,
      password: "",
    };

    setUser(next);
    try {
      localStorage.setItem("ui_user_data", JSON.stringify(next));
    } catch {}
    try {
      document.cookie = `ui_user_data=${encodeURIComponent(JSON.stringify(next))}; Path=/; SameSite=Lax`;
      document.cookie = `ui_fullname=${encodeURIComponent(next.name || '')}; Path=/; SameSite=Lax`;
    } catch {}
  };

  const logout = async () => {
    try {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    } catch {}

    try {
      sessionStorage.removeItem("email");
    } catch {}
    try {
      localStorage.removeItem("ui_user_data");
      localStorage.removeItem("ui_profile_fullName");
    } catch {}
    try {
      document.cookie = 'ui_user_data=; Path=/; Max-Age=0; SameSite=Lax';
      document.cookie = 'ui_fullname=; Path=/; Max-Age=0; SameSite=Lax';
    } catch {}
    setUser(null);
  };

  const updateUser = (updatedData: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const merged: any = { ...prev, ...updatedData };
      const maybeName = pickDisplayName(merged) || pickDisplayName(updatedData);
      if (maybeName && !isPlaceholderName(maybeName)) merged.name = maybeName;
      try {
        localStorage.setItem('ui_user_data', JSON.stringify(merged));
        document.cookie = `ui_user_data=${encodeURIComponent(JSON.stringify(merged))}; Path=/; SameSite=Lax`;
        if (merged.name) {
          document.cookie = `ui_fullname=${encodeURIComponent(merged.name)}; Path=/; SameSite=Lax`;
        }
      } catch {}
      return merged as User;
    });
  };

  return (
    <UserContext.Provider value={{ user, setUser, login, logout, updateUser, refresh }}>
      {children}
    </UserContext.Provider>
  );
};
