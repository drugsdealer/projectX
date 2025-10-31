// @ts-nocheck
"use client";
import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import UserInfo from "./UserInfo";
import UserOrders from "./UserOrders";
import UserSettings from "./UserSettings";
import FavoritesBrands from "./FavoritesBrands";
import PromoCodesClient from "./PromoCodesClient";
import LoyaltyPage from "./loyalty";
import { useUser } from "@/user/UserContext";
import { LogOut } from "lucide-react";

// Типы вкладок в профиле
type Tab =
  | "overview"      
  | "info"         
  | "orders"       
  | "settings"      
  | "favorites"
  | "cards"
  | "promos"
  | "loyalty";

export default function UserProfilePage() {
  const { user } = useUser();

  // Sidebar display name that instantly reflects edits (from context, event, or LS)
  const [displayName, setDisplayName] = useState<string>('Не указано');

  function extractFullName(src: any): string | undefined {
    if (!src) return undefined;
    // Only use first name and last name, not full name field.
    const ln = src.lastName ?? src.surname ?? src.familyName;
    const fn = src.firstName ?? src.givenName ?? src.nameFirst;
    const parts = [fn, ln].map((v:any)=> (v??'').toString().trim()).filter(Boolean);
    return parts.length ? parts.join(' ') : undefined;
  }

  // Helper to read cookies in the browser
  function readCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const all = document.cookie || '';
    if (!all) return undefined;
    const parts = all.split('; ');
    for (const part of parts) {
      if (part.startsWith(name + '=')) {
        const raw = part.slice(name.length + 1);
        try { return decodeURIComponent(raw); } catch { return raw; }
      }
    }
    return undefined;
  }

  React.useEffect(() => {
    // 1) from user context
    const fromCtx = extractFullName(user) || extractFullName((user as any)?.profile);

    // 0.5) from cookie set by API (/api/user/update) for quick UI reflection
    let fromCookie: string | undefined;
    try {
      const cookieName = readCookie('ui_fullname') || readCookie('ui_fullName') || readCookie('ui_name');
      if (cookieName) fromCookie = cookieName;
    } catch {}

    // 2) from localStorage (drafts or saved payloads that UI writes)
    let fromLs: string | undefined;
    try {
      const keys = [
        'user_profile',
        'profile_draft',
        'profile_data',
        'lastSavedProfile',
        'premium_profile',
        'profile:lastSaved',
        'profile:last_saved',
        'ui_profile_fullName',
        'ui_fullname'
      ];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const obj = JSON.parse(raw);
          const n = extractFullName(obj) || extractFullName(obj?.data);
          if (n) { fromLs = n; break; }
        } catch {}
      }
    } catch {}

    setDisplayName(fromCookie || fromLs || fromCtx || 'Не указано');

    // 3) react to runtime updates from the edit form
    const onProfileUpdated = (e: any) => {
      const d = e?.detail || {};
      const n = extractFullName(d) || extractFullName(d?.profile) || extractFullName(d?.data);
      if (n) setDisplayName(n);
      try { localStorage.setItem('ui_profile_fullName', JSON.stringify({ name: n })); } catch {}
    };
    window.addEventListener('profile:updated', onProfileUpdated as any);

    // Also react to other events that may update the name
    const onSaved = (e: any) => {
      const d = e?.detail || {};
      const n = extractFullName(d) || d.fullName || d.name;
      if (n) setDisplayName(n);
    };
    window.addEventListener('profile:saved', onSaved as any);
    window.addEventListener('user:context:updated', onSaved as any);

    // React to localStorage updates from other tabs / components
    const onStorage = (e: StorageEvent) => {
      const watched = ['user_profile', 'profile_draft', 'profile_data', 'lastSavedProfile', 'ui_profile_fullName', 'ui_fullname'];
      if (!watched.includes(e.key || '')) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : null;
        const n = extractFullName(parsed) || extractFullName(parsed?.data) || parsed?.name;
        if (n) setDisplayName(n);
      } catch {}
    };
    window.addEventListener('storage', onStorage);

    // 4) quick fallback to cached ui name
    try {
      const cached = JSON.parse(localStorage.getItem('ui_profile_fullName') || 'null');
      if (!fromCtx && !fromLs && cached?.name) setDisplayName(cached.name);
    } catch {}

    return () => {
      window.removeEventListener('profile:updated', onProfileUpdated as any);
      window.removeEventListener('profile:saved', onSaved as any);
      window.removeEventListener('user:context:updated', onSaved as any);
      window.removeEventListener('storage', onStorage);
    };
  }, [user]);

  // Loyalty points (from user or localStorage fallback)
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  React.useEffect(() => {
    // initialize from user or localStorage
    const init = () => {
      let p = (user as any)?.loyaltyPoints ?? (user as any)?.loyalty?.points;
      if (typeof p === 'number' && !Number.isNaN(p)) {
        setLoyaltyPoints(p);
        return;
      }
      try {
        const s = localStorage.getItem('loyalty_points');
        setLoyaltyPoints(s ? Number(s) || 0 : 0);
      } catch {
        // noop
      }
    };

    init();

    const onStoragePoints = (e: StorageEvent) => {
      if (e.key !== 'loyalty_points') return;
      const val = e.newValue ? Number(e.newValue) : 0;
      if (!Number.isNaN(val)) setLoyaltyPoints(val);
    };

    window.addEventListener('storage', onStoragePoints);
    return () => window.removeEventListener('storage', onStoragePoints);
  }, [user]);

  // --- Avatar picker state & helpers ---
  const PRESET_AVATARS = useMemo(() => [
    "/img/смайлик.png",
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f60e.svg", // 😎
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f60a.svg", // 😊
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f914.svg", // 🤔
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f525.svg", // 🔥
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f680.svg", // 🚀
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f981.svg", // 🦁
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f47b.svg", // 👻
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f984.svg", // 🦄
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f352.svg", // 🍒
  ], []);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const avatarPopRef = React.useRef<HTMLDivElement | null>(null);

  // --- Hover animation for avatar (desktop only, visual only) ---
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(0);
  const hoverTimerRef = React.useRef<number | null>(null);
  const [prevHoverIdx, setPrevHoverIdx] = useState(0);

  function startHoverCycle() {
    if (hoverTimerRef.current !== null) return;
    // rotate through presets every 1100ms (smoother and slower)
    hoverTimerRef.current = window.setInterval(() => {
      setHoverIdx((i) => {
        setPrevHoverIdx(i);
        return (i + 1) % PRESET_AVATARS.length;
      });
    }, 1100);
  }
  function stopHoverCycle() {
    if (hoverTimerRef.current !== null) {
      window.clearInterval(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHoveringAvatar(false);
    setHoverIdx(0);
  }

  const displayAvatar = (isHoveringAvatar && PRESET_AVATARS.length)
    ? PRESET_AVATARS[hoverIdx % PRESET_AVATARS.length]
    : (avatarUrl || "/img/смайлик.png");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('user_avatar_url');
      if (stored) setAvatarUrl(stored);
    } catch {}
  }, []);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!avatarPopRef.current) return;
      if (showAvatarPicker && !avatarPopRef.current.contains(e.target as Node)) {
        setShowAvatarPicker(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showAvatarPicker]);

  function persistAvatar(url: string | null) {
    setAvatarUrl(url);
    try {
      if (url) localStorage.setItem('user_avatar_url', url); else localStorage.removeItem('user_avatar_url');
    } catch {}
    // notify rest of UI
    try {
      window.dispatchEvent(new CustomEvent('profile:avatar:updated', { detail: { avatarUrl: url } }));
    } catch {}
  }

  function selectAvatar(src: string) {
    persistAvatar(src);
    setShowAvatarPicker(false);
  }

  function resetAvatar() {
    persistAvatar("/img/смайлик.png");
  }


  // Инициалы для бейджа-аватара слева
  const initials = useMemo(() => {
    const n = (user?.name || user?.email || "?") as string;
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
  }, [user]);

  const [tab, setTab] = useState<Tab>("info");

  // Stage Mode activation
  const [isStageMode, setIsStageMode] = useState(false);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsStageMode(document.documentElement.classList.contains("stage-mode"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    setIsStageMode(document.documentElement.classList.contains("stage-mode"));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
        {/* Заголовок */}
        <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-6 lg:mb-10">
          Мой профиль
        </h1>

        {/* Двухколоночный лейаут: слева навигация, справа контент */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6 lg:gap-10">
          {/* Sidebar */}
          <aside
            className={`rounded-2xl p-4 lg:p-5 flex flex-col transition-all duration-500 ${
              isStageMode
                ? "bg-[rgba(30,30,30,0.5)] backdrop-blur-xl border-r border-[rgba(255,255,255,0.08)] shadow-[inset_0_0_30px_rgba(255,255,255,0.02),_0_10px_40px_rgba(0,0,0,0.4)] text-gray-100"
                : "bg-white/70 dark:bg-zinc-900/60 backdrop-blur shadow-sm"
            }`}
          >
            {/* Avatar + name/points */}
            <div className="flex items-center gap-6 mb-6 relative">
              <div
                className="relative flex flex-col items-center"
              >
                <div
                  aria-hidden
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowAvatarPicker((v) => !v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAvatarPicker((v)=>!v); } }}
                  onMouseEnter={() => { setIsHoveringAvatar(true); startHoverCycle(); }}
                  onMouseLeave={stopHoverCycle}
                  className="h-24 w-24 md:h-28 md:w-28 shrink-0 rounded-2xl bg-transparent grid place-items-center overflow-hidden ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 cursor-pointer select-none p-1.5 md:p-2"
                >
                  {isHoveringAvatar ? (
                    <div
                      className="relative h-full w-full"
                      style={{ perspective: '800px' }}
                    >
                      {/* Previous (goes back & fades) */}
                      <img
                        key={`prev-${prevHoverIdx}`}
                        src={PRESET_AVATARS[prevHoverIdx % PRESET_AVATARS.length]}
                        alt="Prev"
                        className="absolute inset-0 h-full w-full object-contain select-none"
                        style={{
                          transition:
                            'transform 800ms cubic-bezier(0.16, 1, 0.3, 1), opacity 800ms cubic-bezier(0.16, 1, 0.3, 1), filter 800ms cubic-bezier(0.16, 1, 0.3, 1)',
                          transform: 'translateZ(-60px) scale(0.9)',
                          opacity: 0,
                          filter: 'blur(2px) brightness(0.95)',
                          zIndex: 1,
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/img/смайлик.png";
                        }}
                      />
                      {/* Current (comes forward & brightens) */}
                      <img
                        key={`cur-${hoverIdx}`}
                        src={PRESET_AVATARS[hoverIdx % PRESET_AVATARS.length]}
                        alt="Current"
                        className="absolute inset-0 h-full w-full object-contain select-none"
                        style={{
                          transition:
                            'transform 800ms cubic-bezier(0.16, 1, 0.3, 1), opacity 800ms cubic-bezier(0.16, 1, 0.3, 1)',
                          transform: 'translateZ(0px) scale(1.06)',
                          opacity: 1,
                          zIndex: 2,
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/img/смайлик.png";
                        }}
                      />
                    </div>
                  ) : (
                    <img
                      src={avatarUrl || "/img/смайлик.png"}
                      alt="Avatar"
                      width={96}
                      height={96}
                      className="h-full w-full object-contain select-none"
                      onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = "/img/смайлик.png"; }}
                    />
                  )}
                </div>

                {showAvatarPicker && (
                  <div ref={avatarPopRef} className="absolute z-20 mt-2 left-1/2 -translate-x-1/2 w-64 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-3 shadow-xl backdrop-blur-sm">
                    <div className="text-xs font-medium text-zinc-500 mb-2">Выберите аватар</div>
                    <div className="grid grid-cols-5 gap-2">
                      {PRESET_AVATARS.map((src) => (
                        <button key={src} type="button" onClick={() => selectAvatar(src)} className="rounded-xl overflow-hidden ring-1 ring-transparent hover:ring-zinc-300 transition-transform hover:scale-105">
                          <img src={src} alt="avatar" className="h-10 w-10 object-cover" />
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <button type="button" onClick={() => { setShowAvatarPicker(false); }} className="text-xs text-zinc-500 hover:text-zinc-700">Закрыть</button>
                      <button type="button" onClick={resetAvatar} className="text-xs text-zinc-500 hover:text-zinc-700">Сбросить</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="font-semibold">
                  {/* Оставляем только имя и фамилию, исключая отчество */}
                  {displayName?.split(" ").slice(0, 2).join(" ") || '\u00a0'}
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  <div className="text-zinc-500 dark:text-zinc-400 leading-none">Бонусные баллы</div>
                  <div
                    className="mt-1 max-w-[12rem] inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 font-semibold tabular-nums tracking-tight text-sm md:text-base"
                    title={`${loyaltyPoints.toLocaleString('ru-RU')} ₽`}
                    style={{ lineHeight: 1.1 }}
                  >
                    <span className="truncate">{new Intl.NumberFormat('ru-RU').format(loyaltyPoints)}</span>
                    <span aria-hidden className="opacity-80">₽</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Навигация */}
            <nav className="space-y-1">
              <AnimatedNavItem
                isActive={tab === "info"}
                onClick={() => setTab("info")}
                label="Личная информация"
              />
              <AnimatedNavItem
                isActive={tab === "orders"}
                onClick={() => setTab("orders")}
                label="Мои заказы"
              />
              <AnimatedNavItem
                isActive={tab === "settings"}
                onClick={() => setTab("settings")}
                label="Настройки"
              />
              <AnimatedNavItem
                isActive={tab === "favorites"}
                onClick={() => setTab("favorites")}
                label="Избранные бренды"
              />
              <AnimatedNavItem
                isActive={tab === "cards"}
                onClick={() => setTab("cards")}
                label="Привязанные карты"
              />
              <AnimatedNavItem
                isActive={tab === "promos"}
                onClick={() => setTab("promos")}
                label="Промокоды"
              />
              <AnimatedNavItem
                isActive={tab === "loyalty"}
                onClick={() => setTab("loyalty")}
                label="Stage Loyalty"
              />
              {user?.role === "ADMIN" && (
                <AnimatedNavItem
                  isActive={tab === "admin"}
                  onClick={() => {
                    window.location.href = "/admin";
                  }}
                  label="Админ-панель"
                />
              )}
            </nav>
            <div className="mt-6 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/60"></div>
            <div className="mt-auto pt-4">
              <NavItem
                variant="danger"
                onClick={async () => {
                  try {
                    (window as any).gtag?.('event', 'logout_click');
                  } catch {}

                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.dispatchEvent(new Event('auth:logout'));
                  } catch {}

                  try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                  } catch (e) {
                    console.error('Logout failed', e);
                  }

                  window.location.href = '/';
                }}
              >
                Выйти
              </NavItem>
            </div>
          </aside>

          {/* Content */}
          <section className="min-h-[420px]">
            {tab === "info" && (
              <Panel title="Личная информация">
                <UserInfo />
              </Panel>
            )}

            {tab === "orders" && (
              <Panel title="Мои заказы">
                <UserOrders />
              </Panel>
            )}

            {tab === "settings" && (
              <Panel title="Настройки">
                <UserSettings />
              </Panel>
            )}

            {tab === "favorites" && (
              <Panel title="Избранные бренды">
                <FavoritesBrands />
              </Panel>
            )}

            {tab === "cards" && (
              <Panel title="Привязанные карты">
                <div className="text-sm text-zinc-600 dark:text-zinc-300">Добавьте или удалите платёжные карты. (Скоро)</div>
              </Panel>
            )}

            {tab === "promos" && (
              <Panel title="Промокоды">
                <PromoCodesClient />
              </Panel>
            )}

            {tab === "loyalty" && (
            <Panel title="">
              <div className="relative -mx-4 lg:-mx-6 bg-transparent">
                <LoyaltyPage />
              </div>
            </Panel>
          )}
          </section>
        </div>
      </div>
    </>
  );
}

/** Анимированный пункт навигации для боковой панели профиля */
function AnimatedNavItem({
  isActive,
  onClick,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
}) {
  // Remove border classes, use bg/font for highlighting selection
  return (
    <motion.div
      animate={{ x: isActive ? 12 : 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={[
        "nav-item",
        isActive
          ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white scale-[1.02] ml-3 font-bold"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 font-semibold",
        "rounded-xl px-3 py-2 transition-all duration-300 ease-in-out cursor-pointer",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-zinc-400/40"
      >
        <span className="pl-3 inline-block">{label}</span>
      </button>
    </motion.div>
  );
}

/** Кнопка пункта меню в сайдбаре */
function NavItem({
  active,
  onClick,
  children,
  variant = 'default',
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
}) {
  // Remove border classes for sidebar button, keep highlight with bg/font
  const base =
    "group relative w-full text-left px-3 py-2 rounded-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 transform";
  if (variant === 'danger') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 font-semibold`}
      >
        <LogOut
          className="absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 opacity-70 group-hover:opacity-100 transition-opacity"
        />
        <span className="pl-8 inline-block font-medium">Выйти</span>
      </button>
    );
  }
  // Обычные пункты навигации теперь заменены на AnimatedNavItem выше
  return null;
}

/** Обёртка панели справа: заголовок + карточка */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const t = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(t);
  }, []);
  // Stage Mode detection
  const [isStageMode, setIsStageMode] = React.useState(false);
  React.useEffect(() => {
    const set = () => setIsStageMode(document.documentElement.classList.contains("stage-mode"));
    set();
    const observer = new MutationObserver(set);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return (
    <div className="space-y-4">
      {title ? (<h2 className="text-xl lg:text-2xl font-bold">{title}</h2>) : null}
      <div
        className={[
          "rounded-2xl p-4 lg:p-6 backdrop-blur transition-all duration-300",
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          isStageMode ? "bg-transparent shadow-none border-none" : "bg-white/70 dark:bg-zinc-900/60 shadow-sm",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}