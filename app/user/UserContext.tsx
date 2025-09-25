"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export interface User {
  id?: string;
  name: string;
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
}

interface UserContextType {
  user: User | null;
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
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data?.success && data?.user) {
        const u = data.user as Partial<User>;
        setUser({
          id: u.id,
          name: u.name ?? "Не указано",
          email: u.email,
          phone: u.phone,
          isGuest: false,
          verified: u.verified ?? u.confirmed ?? false,
          confirmed: u.verified ?? u.confirmed ?? false,
          address: u.address,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  // 1) Тянем профиль с сервера по HttpOnly cookie
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.success && data?.user) {
          const u = data.user as Partial<User>;
          setUser({
            id: u.id,
            name: u.name ?? "Не указано",
            email: u.email,
            phone: u.phone,
            isGuest: false,
            verified: u.verified ?? u.confirmed ?? false,
            confirmed: u.verified ?? u.confirmed ?? false,
            address: u.address,
          });
        } else if (!cancelled) {
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for auth:changed event to refresh user
  useEffect(() => {
    const handler = () => { refresh(); };
    window.addEventListener("auth:changed", handler);
    return () => {
      window.removeEventListener("auth:changed", handler);
    };
  }, []);

  const login = (userData: any) => {
    const email =
      userData.email ??
      (userData.method === "email" ? userData.contact : undefined);
    const phone =
      userData.phone ??
      (userData.method === "phone" ? userData.contact : undefined);

    const next: User = {
      id: userData.id,
      name: userData.name ?? "Не указано",
      email,
      phone,
      isGuest: false,
      verified: userData.verified ?? userData.confirmed ?? false,
      confirmed: userData.verified ?? userData.confirmed ?? false,
      address: userData.address,
      password: "",
    };

    setUser(next);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {

    }
    try {
      sessionStorage.removeItem("email");
    } catch {}
    setUser(null);
  };

 
  const updateUser = (updatedData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedData } : null));
  };

  return (
    <UserContext.Provider value={{ user, login, logout, updateUser, refresh }}>
      {children}
    </UserContext.Provider>
  );
};