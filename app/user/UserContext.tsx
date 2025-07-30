"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

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
  
}

interface UserContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  const login = (userData: any) => {
    console.log("Received userData:", userData);
    const newUser: User = {
      name: userData.name ?? "Не указано",
      isGuest: false,
      verified: userData.confirmed ?? false,
      password: userData.password ?? "",
      email: userData.method === "email" ? userData.contact : "",
      phone: userData.method === "phone" ? userData.contact : "",
    };
    console.log("Saving user:", newUser);
    setUser(newUser);
  };

  const logout = () => {
    setUser(null);
  };

  const updateUser = (updatedData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updatedData } : null);
  };

  return (
    <UserContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </UserContext.Provider>
  );
};