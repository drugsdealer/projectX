"use client";

import { useEffect, useMemo, useState } from "react";

type PromoRow = {
  id: number;
  code: string;
  description?: string | null;
  discountType: "PERCENT" | "AMOUNT";
  percentOff?: number | null;
  amountOff?: number | null;
  appliesTo?: "ALL" | "PREMIUM_ONLY" | "NON_PREMIUM_ONLY";
  excludedBrands?: string[] | null;
  minSubtotal?: number | null;
  maxRedemptions?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  createdAt: string;
  usedCount: number;
};

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
};

export default function AdminPromocodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [percentOff, setPercentOff] = useState("");
  const [amountOff, setAmountOff] = useState("");
  const [appliesTo, setAppliesTo] = useState<"ALL" | "PREMIUM_ONLY" | "NON_PREMIUM_ONLY">("ALL");
  const [excludedBrands, setExcludedBrands] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/promocodes", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) setPromoCodes(data.promoCodes || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setCode("");
    setDescription("");
    setDiscountType("PERCENT");
    setPercentOff("");
    setAmountOff("");
    setAppliesTo("ALL");
    setExcludedBrands("");
    setMinSubtotal("");
    setMaxRedemptions("");
    setStartsAt("");
    setEndsAt("");
    setIsActive(true);
  };

  const submit = async () => {
    setMsg(null);
    const payload = {
      code,
      description,
      discountType,
      percentOff: percentOff || undefined,
      amountOff: amountOff || undefined,
      appliesTo,
      excludedBrands,
      minSubtotal: minSubtotal || undefined,
      maxRedemptions: maxRedemptions || undefined,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      isActive,
    };
    const res = await fetch("/api/admin/promocodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setMsg(data?.message || "Не удалось создать промокод");
      return;
    }
    setMsg("Промокод создан");
    resetForm();
    await load();
  };

  const toggleActive = async (id: number, next: boolean) => {
    await fetch("/api/admin/promocodes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: next }),
    });
    await load();
  };

  const remove = async (id: number) => {
    await fetch("/api/admin/promocodes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, delete: true }),
    });
    await load();
  };

  const tableRows = useMemo(() => promoCodes, [promoCodes]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Промокоды</h2>
        <p className="text-xs text-black/50 mt-1">
          Промокоды списываются только после успешной оплаты.
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
        <div className="text-sm font-semibold mb-4">Создать промокод</div>
        {msg && <p className="text-sm text-emerald-700 mb-3">{msg}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Код (STAGE10)"
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание (опционально)"
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "AMOUNT")}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          >
            <option value="PERCENT">Процент</option>
            <option value="AMOUNT">Сумма (₽)</option>
          </select>
          {discountType === "PERCENT" ? (
            <input
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
              placeholder="Скидка, %"
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          ) : (
            <input
              value={amountOff}
              onChange={(e) => setAmountOff(e.target.value)}
              placeholder="Скидка, ₽"
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          )}
          <select
            value={appliesTo}
            onChange={(e) =>
              setAppliesTo(e.target.value as "ALL" | "PREMIUM_ONLY" | "NON_PREMIUM_ONLY")
            }
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          >
            <option value="ALL">Все товары</option>
            <option value="PREMIUM_ONLY">Только Premium</option>
            <option value="NON_PREMIUM_ONLY">Без Premium</option>
          </select>
          <input
            value={excludedBrands}
            onChange={(e) => setExcludedBrands(e.target.value)}
            placeholder="Исключить бренды (через запятую)"
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <input
            value={minSubtotal}
            onChange={(e) => setMinSubtotal(e.target.value)}
            placeholder="Мин. сумма заказа"
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <input
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Лимит использований"
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <input
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            placeholder="Дата начала (YYYY-MM-DD)"
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <input
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            placeholder="Дата окончания (YYYY-MM-DD)"
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Активен
          </label>
          <button
            onClick={submit}
            className="ml-auto rounded-full bg-black text-white px-4 py-2 text-xs font-semibold"
          >
            Создать
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
        <div className="text-sm font-semibold mb-4">Список промокодов</div>
        {loading ? (
          <p className="text-sm text-black/50">Загрузка...</p>
        ) : tableRows.length === 0 ? (
          <p className="text-sm text-black/50">Промокоды не найдены</p>
        ) : (
          <div className="grid gap-3">
            {tableRows.map((p) => {
              const valueLabel =
                p.discountType === "PERCENT"
                  ? `${p.percentOff ?? 0}%`
                  : `${p.amountOff ?? 0}₽`;
              const remaining =
                p.maxRedemptions == null ? "∞" : Math.max(0, p.maxRedemptions - p.usedCount);
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-black/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold">{p.code}</div>
                    <div className="text-xs text-black/60 mt-1">
                      {valueLabel}
                      {p.minSubtotal ? ` · от ${p.minSubtotal}₽` : ""}
                      {p.maxRedemptions != null ? ` · лимит ${p.maxRedemptions}` : " · без лимита"}
                      {` · использовано ${p.usedCount} · осталось ${remaining}`}
                    </div>
                    <div className="text-[11px] text-black/40 mt-1">
                      {p.appliesTo === "PREMIUM_ONLY"
                        ? "Только Premium"
                        : p.appliesTo === "NON_PREMIUM_ONLY"
                        ? "Без Premium"
                        : "Все товары"}
                      {Array.isArray(p.excludedBrands) && p.excludedBrands.length
                        ? ` · исключены бренды: ${p.excludedBrands.join(", ")}`
                        : ""}
                    </div>
                    <div className="text-[11px] text-black/40 mt-1">
                      {p.description ? `${p.description} · ` : ""}
                      {fmtDate(p.startsAt)} — {fmtDate(p.endsAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(p.id, !p.isActive)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                        p.isActive ? "border-emerald-500 text-emerald-700" : "border-gray-300 text-gray-500"
                      }`}
                    >
                      {p.isActive ? "Активен" : "Выключен"}
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="rounded-full px-3 py-1 text-xs font-semibold border border-red-200 text-red-600"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
