"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
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

function buildUserFromLoose(src: any): User | null {
  if (!src) return null;
  const u: User = {
    id: src.id ?? undefined,
    name: pickDisplayName(src),
    fullName: src.fullName ?? undefined,
    email: src.email ?? undefined,
    phone: src.phone ?? undefined,
    isGuest: false,
    verified: src.verified ?? src.confirmed ?? false,
    confirmed: src.verified ?? src.confirmed ?? false,
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

  // Refresh function to fetch user profile from server
  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      const serverUser = data?.success && data?.user
        ? buildUserFromLoose(data.user)
        : null;

      // берём базу из текущего стейта, затем из LS, затем из cookie
      let base: User | null = user;
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
  };

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
  }, []);

  // Listen for auth:changed event to refresh user
  useEffect(() => {
    const handler = () => {
      refresh();
    };
    window.addEventListener("auth:changed", handler);
    return () => {
      window.removeEventListener("auth:changed", handler);
    };
  }, []);

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
      verified: userData.verified ?? userData.confirmed ?? false,
      confirmed: userData.verified ?? userData.confirmed ?? false,
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
