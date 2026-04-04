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
        "relative overflow-hidden rounded-2xl border bg-white shadow-sm transition",
        active
          ? "border-black/10 hover:shadow-md"
          : "border-black/8 grayscale opacity-75"
      )}
    >
      {/* Горизонтальные дырочки перфорации по бокам */}
      <span aria-hidden className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-gray-100 border border-zinc-200 z-10" />
      <span aria-hidden className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-gray-100 border border-zinc-200 z-10" />

      {/* Линия отрыва — SVG зигзаг как у настоящего билета */}
      {!active && (
        <svg
          aria-hidden
          className="absolute top-0 bottom-0 z-10 pointer-events-none"
          style={{ right: "calc(28% - 6px)", width: 12, height: "100%" }}
          preserveAspectRatio="none"
          viewBox="0 0 12 100"
        >
          <polyline
            points="6,0 2,5 10,10 2,15 10,20 2,25 10,30 2,35 10,40 2,45 10,50 2,55 10,60 2,65 10,70 2,75 10,80 2,85 10,90 2,95 6,100"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* Дырочки перфорации на линии отрыва */}
      {!active && (
        <>
          <span aria-hidden className="absolute z-20 h-5 w-5 rounded-full bg-gray-100 border border-zinc-200" style={{ right: "calc(28% - 10px)", top: -10 }} />
          <span aria-hidden className="absolute z-20 h-5 w-5 rounded-full bg-gray-100 border border-zinc-200" style={{ right: "calc(28% - 10px)", bottom: -10 }} />
        </>
      )}

      <div className="flex">
        {/* Левая часть — основной контент */}
        <div className={classNames("relative flex-1 p-5 sm:p-6", !active && "pr-4")}>

          {/* Небрежное зачёркивание — 3 пересекающиеся линии */}
          {!active && (
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10"
              viewBox="0 0 200 80"
              preserveAspectRatio="none"
            >
              {/* Основная диагональ — слева-сверху направо-вниз */}
              <path
                d="M6 18 Q70 28 130 48 Q165 60 196 65"
                stroke="#ef4444"
                strokeWidth="2.8"
                strokeLinecap="round"
                fill="none"
                opacity="0.8"
              />
              {/* Обратная диагональ — пересекает первую */}
              <path
                d="M8 62 Q55 50 110 38 Q155 26 194 16"
                stroke="#ef4444"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
                opacity="0.65"
              />
              {/* Небрежная волна поперёк */}
              <path
                d="M4 40 Q40 32 80 44 Q120 56 160 38 Q182 28 197 42"
                stroke="#ef4444"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
                opacity="0.5"
              />
            </svg>
          )}

          <div className="relative">
            <div className="text-[11px] uppercase tracking-wider text-gray-500">Промокод</div>
            <div className="font-extrabold leading-[0.95] text-[clamp(24px,7vw,44px)] tracking-[0.12em] break-words">
              {ticket.code}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
              {ticket.endsAt ? (
                <span className={active ? "text-red-500 font-medium" : "text-gray-400"}>
                  до {fmtDate(ticket.endsAt)}
                </span>
              ) : (
                <span className="text-gray-400">Без срока</span>
              )}
              {ticket.claimedAt ? (
                <span className="text-gray-400">Активирован: {fmtDate(ticket.claimedAt)}</span>
              ) : null}
              {!active && ticket.usedAt ? (
                <span className="text-rose-500 font-semibold">Использован: {fmtDate(ticket.usedAt)}</span>
              ) : null}
              {!active && !ticket.usedAt && ticket.endsAt ? (
                <span className="text-rose-500 font-semibold">Истёк: {fmtDate(ticket.endsAt)}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Правая часть — скидка (как «корешок» билета) */}
        <div
          className={classNames(
            "shrink-0 flex flex-col items-center justify-center px-4 sm:px-5",
            !active ? "w-[28%]" : "border-l border-dashed border-black/10 pl-4 sm:pl-5 pr-5 sm:pr-6"
          )}
          style={active ? {} : { width: "28%" }}
        >
          <div className="inline-flex w-[72px] h-[72px] items-center justify-center rounded-full border-2 border-black/10 font-extrabold text-[15px] text-black bg-gray-50 select-none text-center leading-tight">
            {ticket.value != null
              ? ticket.type === "PERCENT"
                ? `−${ticket.value}%`
                : ticket.type === "AMOUNT"
                ? `−${ticket.value}₽`
                : `−${ticket.value}`
              : "—"}
          </div>
          {ticket.minSubtotal ? (
            <div className="mt-1.5 text-[10px] text-gray-400 text-center leading-tight">
              от {ticket.minSubtotal}₽
            </div>
          ) : null}
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