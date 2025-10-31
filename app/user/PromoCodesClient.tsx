"use client";

import React from "react";

type ActiveCode = {
  id: number;
  code: string;
  description?: string | null;
  discountType: "PERCENT" | "AMOUNT";
  percentOff?: number | null;
  amountOff?: number | null;
  minSubtotal?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

type OwnedTicket = {
  code: string;
  description?: string | null;
  type?: "PERCENT" | "AMOUNT";
  value?: number | null; // percentOff or amountOff
  minSubtotal?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  claimedAt: string; // ISO
  usedAt?: string | null; // ISO
};

function fmtDate(s?: string | null) {
  if (!s) return "без срока";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString();
}

function classNames(...cn: (string | false | null | undefined)[]) {
  return cn.filter(Boolean).join(" ");
}

function Ticket({
  ticket,
}: {
  ticket: OwnedTicket;
}) {
  const now = Date.now();
  const expired =
    ticket.endsAt != null
      ? (() => {
          const d = new Date(ticket.endsAt as string);
          return !Number.isNaN(d.getTime()) && d.getTime() < now;
        })()
      : false;
  const active = !ticket.usedAt && !expired;
  const label =
    ticket.type === "PERCENT" && ticket.value != null
      ? `−${ticket.value}%`
      : ticket.type === "AMOUNT" && ticket.value != null
      ? `−${ticket.value}₽`
      : "PROMO";

  return (
    <div
      className={classNames(
        "relative overflow-hidden rounded-2xl border border-black/10 bg-white p-5 sm:p-6 shadow-sm transition",
        active ? "hover:shadow-md" : "opacity-80 grayscale"
      )}
    >
      {/* Перфорация (дырочки) */}
      <span
        aria-hidden
        className="absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-gray-100 border border-zinc-200"
      />
      <span
        aria-hidden
        className="absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-gray-100 border border-zinc-200"
      />

      {/* «Оторванный край» у использованных */}
      {!active && (
        <span
          aria-hidden
          className="absolute right-0 top-0 h-full w-10 bg-gray-100"
          style={{
            clipPath:
              "polygon(100% 0, 0 8%, 100% 16%, 0 24%, 100% 32%, 0 40%, 100% 48%, 0 56%, 100% 64%, 0 72%, 100% 80%, 0 88%, 100% 100%)",
          }}
        />
      )}

      {/* Небрежное «ручное» зачеркивание кода — только для использованных */}
      {!active && (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 -rotate-2 opacity-70"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
        >
          <path d="M5 10 L95 14" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M6 22 L94 26" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M5 32 L95 28" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </svg>
      )}

      {/* Контент билета */}
      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4">
          {/* Левая часть — крупный код + даты под ним */}
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-[11px] uppercase tracking-wider text-gray-500">Промокод</div>
              <div className="font-extrabold leading-[0.95] text-[clamp(28px,8vw,48px)] tracking-[0.12em] break-words">
                {ticket.code}
              </div>
            </div>

            {/* Даты под кодом */}
            <div className="mt-2 flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 text-[11px] text-gray-600 break-words">
              {ticket.startsAt ? <span>Начало: {fmtDate(ticket.startsAt)}</span> : null}
              {ticket.endsAt ? (
                <span className="text-red-500 font-medium">
                  Действует до: {fmtDate(ticket.endsAt)}
                </span>
              ) : (
                <span>Без срока действия</span>
              )}
              {ticket.claimedAt ? (
                <span className="text-gray-700">Активирован: {fmtDate(ticket.claimedAt)}</span>
              ) : null}
              {!active && ticket.usedAt ? (
                <span className="text-rose-600 font-semibold">Использован: {fmtDate(ticket.usedAt)}</span>
              ) : null}
              {!active && !ticket.usedAt && ticket.endsAt ? (
                <span className="text-rose-600 font-semibold">
                  Срок действия истёк: {fmtDate(ticket.endsAt)}
                </span>
              ) : null}
            </div>
          </div>

          {/* Правая часть — фиксированная колонка со скидкой */}
         {/* Правая часть — фиксированная колонка со скидкой */}
          <div className="shrink-0 md:pl-4 md:ml-4 md:border-l md:border-black/5 flex flex-col items-end justify-center text-xs text-gray-600">
            {/* Кружок со скидкой */}
            <div className="inline-flex w-[82px] h-[32px] items-center justify-center rounded-full border border-black/10 font-semibold text-black bg-gray-50 select-none">
              {ticket.value != null
                ? ticket.type === "PERCENT"
                  ? `−${ticket.value}%`
                  : ticket.type === "AMOUNT"
                  ? `−${ticket.value}₽`
                  : `−${ticket.value}`
                : "—"}
            </div>

            {/* Минимальная сумма под кружком */}
            {ticket.minSubtotal ? (
              <div className="mt-1 text-[11px] text-gray-500 text-center w-[82px] leading-tight">
                от {ticket.minSubtotal}₽
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromoCodesClient({
  userName,
  active = [],
  my = [],
}: {
  userName?: string;
  active?: ActiveCode[];
  my?: { code: string; usedAt: string }[];
}) {
  const [input, setInput] = React.useState("");
  const [info, setInfo] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [owned, setOwned] = React.useState<OwnedTicket[]>([]);
  const [loadingOwned, setLoadingOwned] = React.useState(false);
  const [errorOwned, setErrorOwned] = React.useState<string | null>(null);

  async function loadOwned() {
    setLoadingOwned(true);
    setErrorOwned(null);
    try {
      const res = await fetch("/api/promocodes/owned");
      if (!res.ok) {
        throw new Error(`Ошибка загрузки промокодов: ${res.statusText}`);
      }
      const data = await res.json();
      if (!Array.isArray(data?.promoCodes)) {
      throw new Error("Неверный формат данных промокодов");
      }
      setOwned(data.promoCodes);
    } catch (e: any) {
      setErrorOwned(e.message || "Ошибка загрузки промокодов");
    } finally {
      setLoadingOwned(false);
    }
  }

  React.useEffect(() => {
    loadOwned();
  }, []);

  function mergeFromValidation(code: string, payload: any) {
    // ожидаем data.code = { type: 'percent'|'amount', value: number }, data.startsAt/endsAt
    const exists = owned.some((t) => t.code.toUpperCase() === code.toUpperCase());
    if (exists) return;
    const type = payload?.code?.type === "percent" ? "PERCENT" : payload?.code?.type === "amount" ? "AMOUNT" : undefined;
    const value = typeof payload?.code?.value === "number" ? payload.code.value : undefined;
    const startsAt = payload?.startsAt ?? payload?.code?.startsAt ?? null;
    const endsAt = payload?.endsAt ?? payload?.code?.endsAt ?? null;
    const description = payload?.description ?? null;
    const t: OwnedTicket = {
      code,
      type,
      value,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
      description: description ?? null,
      claimedAt: new Date().toISOString(),
    };
    setOwned((prev) => [t, ...prev]);
  }

  async function validate(subtotal?: number) {
    setLoading(true);
    setInfo(null);
    setErr(null);
    try {
      const res = await fetch("/api/promocodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: input.trim(), subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data?.error || "Неверный промокод");
      } else {
        const human =
          data.code.type === "percent"
            ? `${data.code.value}%`
            : `${data.code.value}₽`;
        setInfo(
          `Код принят: −${human}${
            data.newTotal ? `, итого: ${data.newTotal}₽` : ""
          }`
        );
        // Сохраняем в базу
        try {
          const saveRes = await fetch("/api/promocodes/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: input.trim() }),
          });
          const saveData = await saveRes.json();
          if (!saveRes.ok || !saveData.ok) {
            setErr(saveData?.error || "Ошибка сохранения промокода");
          } else {
            await loadOwned();
          }
        } catch {
          setErr("Ошибка сети при сохранении промокода");
        }
      }
    } catch {
      setErr("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function redeem(codeArg?: string) {
    const code = (codeArg || input).trim();
    if (!code) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/promocodes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data?.error || "Не удалось активировать");
      } else {
        // После успешной активации перезагружаем список из БД,
        // чтобы источник правды всегда был на сервере
        setInfo("Промокод активирован!");
        try {
          await loadOwned();
        } catch {
          // если не получилось перезагрузить, оставляем текущий список
        }
      }
    } catch {
      setErr("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  const onPick = (code: string) => {
    setInput(code);
    setInfo(null);
    setErr(null);
  };

  // Секции: активные (неиспользованные и не просроченные) и использованные/истёкшие
  const nowTs = Date.now();
  const isExpired = (t: OwnedTicket) => {
    if (!t.endsAt) return false;
    const d = new Date(t.endsAt);
    if (Number.isNaN(d.getTime())) return false;
    return d.getTime() < nowTs;
  };
  const activeOwned = owned.filter((t) => !t.usedAt && !isExpired(t));
  const usedAll = owned
    .filter((t) => t.usedAt || isExpired(t))
    .slice()
    .sort((a, b) => {
      const aKey = a.usedAt ?? a.endsAt ?? a.claimedAt;
      const bKey = b.usedAt ?? b.endsAt ?? b.claimedAt;
      return +new Date(bKey) - +new Date(aKey);
    });

  return (
    <div className="mt-6 grid grid-cols-1 gap-6">
      {/* Ввод кода */}
      <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-bold">Введите промокод</div>
            {userName ? (
              <div className="text-xs text-gray-500">
                Пользователь: <span className="font-semibold">{userName}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Введите код, например: WELCOME10"
            className="flex-1 rounded-xl border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
          />
          <div className="flex gap-2">
            <button
              onClick={() => validate()}
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-xl border border-black/10 hover:bg-black hover:text-white transition"
            >
              {loading ? "Загрузка..." : "Проверить"}
            </button>
          </div>
        </div>

        {info && <div className="mt-3 text-sm text-green-600">{info}</div>}
        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      </div>

      {/* Мои промокоды (активные билеты) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-bold">Мои промокоды</div>
          {loadingOwned ? (
            <div className="text-xs text-gray-500">Загрузка...</div>
          ) : errorOwned ? (
            <div className="text-xs text-red-600">Ошибка: {errorOwned}</div>
          ) : (
            activeOwned.length > 0 && (
              <div className="text-xs text-gray-500">активных: {activeOwned.length}</div>
            )
          )}
        </div>
        {loadingOwned ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-center text-gray-500">
            Загрузка промокодов...
          </div>
        ) : errorOwned ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-center text-red-600">
            Ошибка загрузки промокодов: {errorOwned}
          </div>
        ) : activeOwned.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-center text-gray-500">
            Добавьте промокод — он появится здесь красивым «билетом».
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {activeOwned.map((t) => (
              <Ticket key={t.code} ticket={t} />
            ))}
          </div>
        )}
      </div>

      {/* Использованные — как «билеты» с оторванным краем */}
      <div>
        <div className="text-lg font-bold mb-3">Использованные</div>
        {usedAll.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-center text-gray-500">
            Здесь появятся использованные промокоды.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {usedAll.map((t) => (
              <Ticket
                key={`${t.code}-${t.usedAt ?? t.endsAt ?? t.claimedAt}`}
                ticket={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* (необязательно) Доступные промо от системы — можно скрыть, если не нужно */}
      {false && (
        <div>
          <div className="text-lg font-bold mb-3">Рекомендованные промо</div>
          {active.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white p-6 text-center text-gray-500">
              Пока нет активных промокодов
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {active.map((p) => {
                const label =
                  p.discountType === "PERCENT" && p.percentOff != null
                    ? `−${p.percentOff}%`
                    : p.discountType === "AMOUNT" && p.amountOff != null
                    ? `−${p.amountOff}₽`
                    : "Промо";
                return (
                  <button
                    key={p.id}
                    onClick={() => onPick(p.code)}
                    className="group rounded-2xl border border-black/10 bg-white p-4 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-extrabold">{label}</div>
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-black text-white">
                        {p.code}
                      </span>
                    </div>
                    {p.description && (
                      <div className="text-sm text-gray-600 mt-2">{p.description}</div>
                    )}
                    {p.minSubtotal ? (
                      <div className="text-xs text-gray-400 mt-1">от {p.minSubtotal}₽</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}