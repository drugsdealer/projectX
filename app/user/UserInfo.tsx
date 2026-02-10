import React, { useState, useEffect, useMemo, useRef } from "react";
// inline keyframes for sheet animation
const sheetStyle = (
  <style>{`@keyframes sheetIn{from{transform:translateY(16px);opacity:.0}to{transform:translateY(0);opacity:1}}`}</style>
);
import { useRouter } from "next/navigation";
import { useUser } from "@/user/UserContext";
// helpers: phone mask
function digitsOnly(v: string) {
  return (v || '').replace(/\D/g, '');
}
function normalizeName(n: string) {
  const t = (n || '').trim();
  const low = t.toLowerCase();
  if (!t) return '';
  if (low === 'не указано' || low === 'введите фио') return '';
  return t;
}
function formatPhone(v: string) {
  // форматируем к виду +7 (XXX) XXX-XX-XX во время ввода
  let d = digitsOnly(v);
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d.startsWith('7')) d = '7' + d.slice(1, 11);
  if (d.startsWith('9')) d = '7' + d.slice(0, 10); // без 7/8 в начале
  let out = '+7';
  if (d.length > 1) {
    const body = d.slice(1);
    const p1 = body.slice(0, 3);
    const p2 = body.slice(3, 6);
    const p3 = body.slice(6, 8);
    const p4 = body.slice(8, 10);
    out += (p1 ? ` (${p1}` : ' (');
    out += p1 && p1.length === 3 ? ')' : '';
    if (p2) out += ` ${p2}`;
    if (p3) out += `-${p3}`;
    if (p4) out += `-${p4}`;
  } else {
    out += ' (';
  }
  return out.trim();
}

// helper: show only first and last name in UI/sidebar/cookie
function firstLast(full: string): string {
  const parts = normalizeName(full).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  // Показываем именно firstName + lastName (а не lastName + firstName)
  return `${parts[0]}${parts[1] ? ' ' + parts[1] : ''}`;
}

// --- Cookie helpers and safe JSON parse ---
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function readCookieJSON<T = any>(name: string): T | null {
  try { const v = readCookie(name); return v ? JSON.parse(v) as T : null; } catch { return null; }
}

// Debug tags: [user.update] [user.audit]

export default function UserInfo() {
  const { user, refresh } = useUser();
  const isVerified = Boolean((user as any)?.verified);
  const RUS_CITIES = [
  "Москва","Санкт-Петербург","Казань","Екатеринбург","Новосибирск",
  "Нижний Новгород","Самара","Ростов-на-Дону","Краснодар","Воронеж",
  "Уфа","Пермь"
];
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [cityOpen, setCityOpen] = useState(false);

  // --- editable profile state ---
  const [isEditing, setIsEditing] = useState(true);
  const [draft, setDraft] = useState({
    name: normalizeName(user?.fullName || user?.name || ''),
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    birthDate: user?.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '',
    gender: user?.gender || '',
  });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string; birthDate?: string }>({});

  // --- local view model for optimistic UI updates ---
  type ViewUser = { name: string; phone?: string; address?: string; email?: string; verified?: boolean; gender?: string; birthDate?: string; city?: string; avatarEmoji?: string };
  const [viewUser, setViewUser] = useState<ViewUser>({
    name: normalizeName(user?.fullName || user?.name || ""),
    phone: user?.phone,
    address: (user as any)?.address,
    email: user?.email,
    verified: (user as any)?.verified,
    gender: (user as any)?.gender,
    birthDate: (user as any)?.birthDate,
    city: (user as any)?.city,
    avatarEmoji: (user as any)?.avatarEmoji,
  });
  const [cachedReady, setCachedReady] = useState(false);
  const hydratedRef = useRef(false);
  const DRAFT_KEY = "profile_draft_v1";
  const draftTimer = useRef<any>(null);

  useEffect(() => {
    // Первичная гидрация из localStorage/cookie, чтобы не терять данные между перезагрузками
    try {
      const draftRaw = localStorage.getItem(DRAFT_KEY);
      if (draftRaw) {
        const d = JSON.parse(draftRaw);
        setDraft((prev) => ({
          ...prev,
          name: normalizeName(d.name ?? prev.name),
          phone: d.phone ?? prev.phone,
          address: d.address ?? prev.address,
          gender: d.gender ?? prev.gender,
          birthDate: d.birthDate ?? prev.birthDate,
          city: d.city ?? prev.city,
        }));
        setCachedReady(true);
        hydratedRef.current = true;
        return;
      }
      const ls = localStorage.getItem('ui_user_data');
      if (ls) {
        const u = JSON.parse(ls);
        setViewUser((prev) => ({
          ...prev,
          name: normalizeName(u.fullName ?? u.name ?? prev.name),
          phone: u.phone ?? prev.phone,
          address: u.address ?? prev.address,
          email: u.email ?? prev.email,
          verified: u.verified ?? prev.verified,
          gender: u.gender ?? prev.gender,
          birthDate: u.birthDate ?? prev.birthDate,
          city: u.city ?? prev.city,
        }));
        setDraft((d) => ({
          ...d,
          name: normalizeName(u.fullName ?? u.name ?? d.name),
          phone: u.phone ? formatPhone(u.phone) : d.phone,
          address: u.address ?? d.address,
          gender: u.gender ?? d.gender,
          birthDate: u.birthDate ? new Date(u.birthDate).toISOString().split('T')[0] : d.birthDate,
          city: u.city ?? d.city,
        }));
        setCachedReady(true);
        hydratedRef.current = true;
        return;
      }
    } catch {}
    const ck = readCookieJSON<any>('ui_user_data');
    if (ck) {
      setViewUser((prev) => ({
        ...prev,
        name: normalizeName(ck.fullName ?? ck.name ?? prev.name),
        phone: ck.phone ?? prev.phone,
        address: ck.address ?? prev.address,
        email: ck.email ?? prev.email,
        verified: ck.verified ?? prev.verified,
        gender: ck.gender ?? prev.gender,
        birthDate: ck.birthDate ?? prev.birthDate,
        city: ck.city ?? prev.city,
      }));
      setDraft((d) => ({
        ...d,
        name: normalizeName(ck.fullName ?? ck.name ?? d.name),
        phone: ck.phone ? formatPhone(ck.phone) : d.phone,
        address: ck.address ?? d.address,
        gender: ck.gender ?? d.gender,
        birthDate: ck.birthDate ? new Date(ck.birthDate).toISOString().split('T')[0] : d.birthDate,
        city: ck.city ?? d.city,
      }));
      hydratedRef.current = true;
    }
    setCachedReady(true);
  }, []);

  useEffect(() => {
    // If we already hydrated from local cache, do not clobber the form with empty server user
    if (hydratedRef.current) return;
    const hasServerData = Boolean(
      (user && (
        user.name || user.phone || (user as any)?.address || (user as any)?.gender || (user as any)?.birthDate || (user as any)?.city
      ))
    );
    if (!hasServerData) return; // nothing meaningful from server yet

    setViewUser({
      name: normalizeName(user?.fullName || user?.name || ""),
      phone: user?.phone,
      address: (user as any)?.address,
      email: user?.email,
      verified: (user as any)?.verified,
      gender: (user as any)?.gender,
      birthDate: (user as any)?.birthDate,
      city: (user as any)?.city,
    });
    setDraft({
      name: normalizeName(user?.fullName || user?.name || ''),
      phone: user?.phone || '',
      address: user?.address || '',
      city: user?.city || '',
      birthDate: user?.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '',
      gender: user?.gender || '',
    });
    hydratedRef.current = true;
  }, [user]);

  // Keep form in sync with SERVER user, но не затирать локальный кэш
  useEffect(() => {
    if (!user) return;

    const srv = {
      name: normalizeName(user?.fullName || user?.name || ''),
      phone: user?.phone || '',
      address: user?.address || '',
      city: user?.city || '',
      birthDate: user?.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '',
      gender: user?.gender || '',
    };

    const hasServerData = Object.values(srv).some(v => (v ?? '').toString().trim().length > 0);
    if (!hasServerData) return;

    // Если уже гидрировались из LS/cookie, не перетирать на более пустые данные сервера
    const draftEmpty = Object.values(draft).filter(v => !v || (v as string).trim() === '').length;
    const srvEmpty = Object.values(srv).filter(v => !v || (v as string).trim() === '').length;
    if (hydratedRef.current && srvEmpty >= draftEmpty) {
      return;
    }

    setViewUser(prev => ({
      ...prev,
      ...srv,
      email: user?.email,
      verified: (user as any)?.verified,
    }));
    setDraft(srv);
  }, [user]);

  // Автосохранение черновика профиля
  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        const payload = { ...draft, name: normalizeName(draft.name), ts: Date.now() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch {}
    }, 400);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [draft]);

  const dirtyKeys = useMemo(() => {
    const keys: string[] = [];
    if ((user?.fullName || user?.name || "") !== draft.name) keys.push("name");
    if ((user?.phone || "") !== draft.phone) keys.push("phone");
    if (((user as any)?.address || "") !== draft.address) keys.push("address");
    if (((user as any)?.gender || "") !== draft.gender) keys.push("gender");
    if (((user as any)?.birthDate || "") !== draft.birthDate) keys.push("birthDate");
    if (((user as any)?.city || "") !== draft.city) keys.push("city");
    // avatarEmoji removed from draft, so no check here
    return keys;
  }, [user?.fullName, user?.name, user?.phone, (user as any)?.address, draft]);

  const hasChanges = dirtyKeys.length > 0;

  const onField = (
    key: "name" | "phone" | "address" | "gender" | "birthDate" | "city"
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setDraft((d) => ({ ...d, [key]: val }));
    setFormErrors((fe) => ({ ...fe, [key]: undefined } as any));
  };

 
    const normalizePhone = (v: string) => {
      const d = digitsOnly(v);
      if (!d) return '';
      let num = d;
      if (num.startsWith('8')) num = '7' + num.slice(1);
      if (num.startsWith('9')) num = '7' + num; // без 7/8 в начале
      return '+' + num;
    };

  const validateDraft = () => {
    const errs: { name?: string; phone?: string; birthDate?: string } = {};
    if (!draft.name.trim()) errs.name = 'Укажите ФИО';

    const ph = draft.phone.trim();
    if (!ph) {
      errs.phone = 'Укажите телефон';
    } else {
      const normalized = normalizePhone(ph);
      if (!/^\+?\d{7,}$/.test(normalized)) errs.phone = 'Некорректный телефон';
    }

    // Дата рождения — обязательна
    const bd = (draft.birthDate || '').trim();
    if (!bd) {
      errs.birthDate = 'Укажите дату рождения';
    } else {
      const d = new Date(bd);
      const now = new Date();
      const age = (now.getTime() - d.getTime()) / (1000*60*60*24*365.25);
      if (isNaN(d.getTime()) || d > now) errs.birthDate = 'Некорректная дата';
      else if (age < 13) errs.birthDate = 'Минимальный возраст 13 лет';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const maskEmail = (email?: string) => {
    if (!email || !email.includes("@")) return email || "";
    const [name, domain] = email.split("@");
    const masked = name.length <= 2 ? name[0] + "*" : name[0] + "***" + name.slice(-1);
    return `${masked}@${domain}`;
  };

  // Если нет серверного пользователя, но есть кэш — позволяем редактировать и сохранять в локальный профиль
  if (!user && !cachedReady) {
    return (
      <div className="p-4">Загрузка…</div>
    );
  }

  const sendCode = async () => {
    if (!user?.email) {
      setError("У аккаунта не указан email.");
      return;
    }
    setIsSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Не удалось отправить код");
      }
      setCodeSent(true);
      setMessage(`Код отправлен на ${maskEmail(user.email)}.`);
      setCooldown(60);
      try { sessionStorage.setItem("email", user.email); } catch {}
      if (data.devCode) {
        setCode(data.devCode);
      }
    } catch (e: any) {
      setError(e.message || "Ошибка при отправке кода");
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    if (!user?.email) {
      setError("У аккаунта не указан email.");
      return;
    }
    setIsVerifying(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Неверный или истёкший код");
      }
      setMessage("Email подтверждён.");
      window.dispatchEvent(new Event("auth:changed"));
      await refresh();
    } catch (e: any) {
      setError(e.message || "Не удалось подтвердить код");
    } finally {
      setIsVerifying(false);
    }
  };

  const saveProfile = async () => {
    if (!hasChanges || saving) return;
    if (!validateDraft()) {
      setError('Заполните обязательные поля');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    // prepare change set for audit
    const before: Record<string, any> = {
      name: user?.fullName || user?.name || "",
      phone: user?.phone ? formatPhone(user.phone) : "",
      address: (user as any)?.address || "",
      gender: (user as any)?.gender || "",
      birthDate: (user as any)?.birthDate || "",
      city: (user as any)?.city || "",
    };
    // Ensure birthDate is ISO string for server
    const formattedDate = draft.birthDate ? new Date(draft.birthDate).toISOString() : null;
    console.log("[user.update] formatted birthDate from draft:", draft.birthDate, "=>", formattedDate);
    const after: Record<string, any> = {
      name: draft.name.trim(),
      phone: normalizePhone(draft.phone.trim()),
      address: draft.address.trim(),
      gender: draft.gender,
      birthDate: formattedDate,
      city: draft.city,
    };
    const changes: Record<string, any> = {};
    for (const k of ["name", "phone", "address", "gender", "birthDate", "city"] as const) {
      if (before[k] !== after[k]) changes[k] = { from: before[k], to: after[k] };
    }

    try {
      // Update profile
      console.log("[user.update] submitting birthDate:", after.birthDate);
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: user?.email || null,
          fullName: after.name, // server expects fullName
          phone: after.phone,
          address: after.address,
          gender: after.gender,
          birthDate: after.birthDate,
          city: after.city,
        }),
      });
      const data = await res.json().catch(() => null);
      console.log('[user.update] response', { ok: res.ok, status: res.status, data });
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Не удалось сохранить изменения");
      }

      // Optimistic UI update
      setViewUser((prev) => ({
        ...prev,
        name: after.name,
        phone: after.phone,
        address: after.address,
        gender: after.gender,
        birthDate: after.birthDate,
        city: after.city,
      }));

      // Mirror UI caches (cookies + localStorage) — чтобы профиль не терялся между перезагрузками
      try {
        const uiPayload = {
          name: after.name,
          fullName: after.name,
          phone: after.phone,
          address: after.address,
          gender: after.gender,
          birthDate: after.birthDate,
          city: after.city,
          email: user?.email ?? null,
          verified: viewUser.verified ?? false,
        };
        localStorage.setItem('ui_user_data', JSON.stringify(uiPayload));
        document.cookie = `ui_user_data=${encodeURIComponent(JSON.stringify(uiPayload))}; Path=/; SameSite=Lax`;
        document.cookie = `ui_fullname=${encodeURIComponent(firstLast(after.name))}; Path=/; SameSite=Lax`;
        localStorage.removeItem(DRAFT_KEY);
        window.dispatchEvent(new CustomEvent('user:context:updated', { detail: { name: after.name } }));
        window.dispatchEvent(new Event('profile:saved'));
      } catch {}

      // Sync with server-side cookie profile (if available)
      try {
        const r = await fetch('/api/user/update', { method: 'GET', credentials: 'include' });
        const j = await r.json().catch(() => null);
        if (j?.profile) {
          const p = j.profile as { fullName?: string; phone?: string; address?: string; email?: string; gender?: string; birthDate?: string; city?: string; };
          setViewUser((prev) => ({
            ...prev,
            name: p.fullName ?? prev.name,
            phone: p.phone ?? prev.phone,
            address: p.address ?? prev.address,
            email: p.email ?? prev.email,
            gender: (p as any).gender ?? prev.gender,
            birthDate: (p as any).birthDate ?? prev.birthDate,
            city: (p as any).city ?? prev.city,
          }));
        }
      } catch {}

      // Optional: send audit trail (backend may be no-op if отсутствует)
      try {
        await fetch("/api/user/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "profile.update",
            at: new Date().toISOString(),
            email: user?.email || null,
            changes,
          }),
        });
        console.log('[user.audit] sent', { changes });
      } catch {}

      setMessage("Профиль обновлён.");
      setIsEditing(false);
      await refresh(); // подтягиваем новые данные и обновлённые cookies с бэка
    } catch (e: any) {
      console.error('[user.update] failed', e);
      setError(e.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      try { sessionStorage.removeItem("email"); } catch {}
      try {
        localStorage.removeItem('ui_user_data');
        document.cookie = 'ui_user_data=; Path=/; Max-Age=0; SameSite=Lax';
        document.cookie = 'ui_fullname=; Path=/; Max-Age=0; SameSite=Lax';
      } catch {}
      window.dispatchEvent(new Event("auth:changed"));
      await refresh();
      router.push("/");
    } catch (e) {
      // no-op
    }
  };

  return (
    <div className="px-2 sm:px-4">
      <div className="relative">
        {sheetStyle}
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-black/50">Аккаунт</div>
              <div className="text-2xl font-extrabold tracking-tight text-black/80">
                {firstLast(user?.fullName || "") || "Введите ФИО"}
              </div>
            </div>
            <span className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${viewUser.verified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {viewUser.verified ? 'Подтверждён' : 'Не подтверждён'}
              </span>
            </span>
          </div>
          <div className="mt-3 h-[3px] rounded-full bg-gradient-to-r from-black via-black/70 to-transparent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-2">
          {viewUser.email && (
            <p className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-black/60" /> <span className="text-black/60">Email:</span> <span className="font-medium">{viewUser.email || ''}</span></p>
          )}
          {viewUser.phone && (
            <p className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-black/60" /> <span className="text-black/60">Телефон:</span> <span className="font-medium">{viewUser.phone || ''}</span></p>
          )}
        </div>

        <>
          <form className="mt-6 space-y-6" onSubmit={(e)=>{e.preventDefault(); saveProfile();}}>
            {/* Full name */}
            <label className="block">
              <span className="block text-sm text-black/60 mb-1">ФИО <span className="text-red-500">*</span></span>
              <input
                value={draft.name}
                onChange={onField("name")}
                placeholder="Введите ФИО"
                className={`w-full border-b border-black/10 focus:border-black transition px-1 py-3 outline-none placeholder:text-black/40 ${formErrors.name ? 'border-red-400 focus:border-red-500' : ''}`}
                aria-invalid={!!formErrors.name}
                aria-describedby={formErrors.name ? 'err-name' : undefined}
              />
              {formErrors.name && (
                <span id="err-name" className="mt-1 block text-xs text-red-600">{formErrors.name}</span>
              )}
            </label>

            {/* Phone */}
            <label className="block">
              <span className="block text-sm text-black/60 mb-1">Номер телефона</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">🇷🇺</span>
                <input
                  value={draft.phone}
                  onChange={(e) => {
                    const next = formatPhone(e.target.value);
                    setDraft(d => ({ ...d, phone: next }));
                    setFormErrors(fe => ({ ...fe, phone: undefined }));
                  }}
                  onPaste={(e) => {
                    const t = e.clipboardData.getData('text');
                    if (t) {
                      e.preventDefault();
                      const next = formatPhone(t);
                      setDraft(d => ({ ...d, phone: next }));
                      setFormErrors(fe => ({ ...fe, phone: undefined }));
                    }
                  }}
                  placeholder="+7 (___) ___-__-__"
                  inputMode="tel"
                  className={`w-full border-b border-black/10 focus:border-black transition px-1 py-3 outline-none ${formErrors.phone ? 'border-red-400 focus:border-red-500' : ''}`}
                  aria-invalid={!!formErrors.phone}
                  aria-describedby={formErrors.phone ? 'err-phone' : undefined}
                />
              </div>
              {formErrors.phone && (
                <span id="err-phone" className="mt-1 block text-xs text-red-600">{formErrors.phone}</span>
              )}
            </label>

            {/* Gender */}
            <div>
              <span className="block text-sm text-black/60 mb-1">Пол</span>
              <div className="inline-flex rounded-xl border border-black/10 bg-white overflow-hidden">
                <button
                  type="button"
                  aria-pressed={draft.gender === 'male'}
                  onClick={() => setDraft(d => ({ ...d, gender: d.gender === 'male' ? '' : 'male' }))}
                  className={`px-4 py-2 text-sm transition ${draft.gender === 'male' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                >
                  Мужской
                </button>
                <button
                  type="button"
                  aria-pressed={draft.gender === 'female'}
                  onClick={() => setDraft(d => ({ ...d, gender: d.gender === 'female' ? '' : 'female' }))}
                  className={`px-4 py-2 text-sm transition border-l border-black/10 ${draft.gender === 'female' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                >
                  Женский
                </button>
              </div>
              {draft.gender && (
                <button
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, gender: '' }))}
                  className="ml-3 text-xs text-black/50 hover:text-black/80 underline"
                >
                  Сбросить
                </button>
              )}
            </div>

            {/* Birth date */}
            <label className="block">
              <span className="block text-sm text-black/60 mb-1">Дата рождения <span className="text-red-500">*</span></span>
              <input
                type="date"
                value={draft.birthDate}
                onChange={onField("birthDate")}
                className={`w-full border-b border-black/10 focus:border-black transition px-1 py-3 outline-none ${formErrors.birthDate ? 'border-red-400 focus:border-red-500' : ''}`}
                aria-invalid={!!formErrors.birthDate}
                aria-describedby={formErrors.birthDate ? 'err-birth' : undefined}
              />
              {formErrors.birthDate && (
                <span id="err-birth" className="mt-1 block text-xs text-red-600">{formErrors.birthDate}</span>
              )}
            </label>

            {/* Address */}
            <label className="block">
              <span className="block text-sm text-black/60 mb-1">Адрес</span>
              <input
                value={draft.address}
                onChange={onField("address")}
                placeholder="Город, улица, дом, квартира"
                className="w-full border-b border-black/10 focus:border-black transition px-1 py-3 outline-none"
              />
            </label>


            {/* City (custom dropdown) */}
            <div>
              <span className="block text-sm text-black/60 mb-1">Город</span>
              <div className="relative" onKeyDown={(e) => { if (e.key === 'Escape') setCityOpen(false); }}>
                <button
                  type="button"
                  onClick={() => setCityOpen(o => !o)}
                  className="w-full border-b border-black/10 focus:border-black transition px-1 py-3 outline-none text-left flex items-center justify-between"
                  aria-haspopup="listbox"
                  aria-expanded={cityOpen}
                >
                  <span>{draft.city || 'Не указан'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition ${cityOpen ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {cityOpen && (
                  <div className="absolute z-50 mt-2 w-full rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden animate-[sheetIn_.2s_ease-out]">
                    <div className="max-h-56 overflow-auto">
                      <button
                        type="button"
                        onClick={() => { setDraft(d => ({ ...d, city: '' })); setCityOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-black/5 ${!draft.city ? 'bg-black/5' : ''}`}
                        role="option"
                        aria-selected={!draft.city}
                      >
                        Не указан
                      </button>
                      {RUS_CITIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setDraft(d => ({ ...d, city: c })); setCityOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-black/5 ${draft.city === c ? 'bg-black/5' : ''}`}
                          role="option"
                          aria-selected={draft.city === c}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>
          {/* Sticky save bar */}
          <div className="sticky bottom-0 inset-x-0 z-40 mt-2 -mx-5 px-5 py-3 bg-white/80 dark:bg-black/40 backdrop-blur border-t border-black/10 flex items-center gap-3">
            <button
              onClick={saveProfile}
              disabled={
                !hasChanges ||
                saving ||
                !draft.name.trim() ||
                !!formErrors.name ||
                !!formErrors.phone ||
                !!formErrors.birthDate ||
                !draft.birthDate.trim()
              }
              className="px-4 py-2.5 bg-black text-white rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? "Сохраняем…" : "Сохранить изменения"}
            </button>
            <span className="text-xs text-black/60">
              {hasChanges ? `Изменено полей: ${dirtyKeys.length}` : "Нет несохранённых изменений"}
            </span>
          </div>
        </>

        {!isVerified && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-gray-700">Подтвердите email, чтобы защитить аккаунт</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={sendCode}
                disabled={isSending || cooldown > 0}
                className="px-3 py-2 bg-black text-white rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSending ? 'Отправляем…' : cooldown > 0 ? `Повтор через ${cooldown}s` : 'Отправить код'}
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t) setCode(t.replace(/\D/g, '').slice(0, 6)); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && code.replace(/\D/g, '').length === 6) verifyCode(); }}
                placeholder="Код из письма"
                className="p-2.5 border rounded-lg w-44 tracking-[0.4em] text-center font-mono"
                aria-label="Код подтверждения"
              />
              <button
                onClick={verifyCode}
                disabled={isVerifying || code.replace(/\D/g, '').length !== 6}
                className="px-3 py-2 bg-black text-white rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isVerifying ? 'Проверяем…' : 'Подтвердить'}
              </button>
            </div>
            {codeSent && (
              <p className="text-xs text-gray-600">Код отправлен на {maskEmail(user?.email)} (действителен 5 минут).</p>
            )}
            {message && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{message}</p>}
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          </div>
        )}

      </div>
    </div>
  );
}
