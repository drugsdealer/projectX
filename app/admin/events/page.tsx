"use client";

import { useEffect, useMemo, useState } from "react";

type FunnelStep = {
  eventType: string;
  events: number;
  conversionFromPrevious: number | null;
};

type FunnelPayload = {
  from: string;
  to: string;
  overallConversion: number;
  steps: FunnelStep[];
};

type TopProduct = {
  productId: number;
  views: number;
  addToCart: number;
  purchases: number;
  viewToCartConversion: number;
  cartToPurchaseConversion: number;
};

type TopBrand = {
  brandId: number;
  brandName: string;
  views: number;
  addToCart: number;
  purchases: number;
  brandClicks: number;
  weightedScore: number;
};

type Preset = 7 | 30 | 90;

function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toIsoDayStart(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function toIsoDayEnd(value: string): string {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString("ru-RU");
}

const EVENT_COLORS = [
  "#111111",
  "#2563eb",
  "#ea580c",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
  "#0f766e",
];

const STEP_LABELS: Record<string, string> = {
  PRODUCT_VIEW: "Просмотры",
  ADD_TO_CART: "Добавления в корзину",
  START_CHECKOUT: "Начало оформления",
  PURCHASE: "Покупки",
  SEARCH: "Поиск",
  FAVORITE_ADD: "Добавления в избранное",
  REMOVE_FROM_CART: "Удаления из корзины",
  BRAND_CLICK: "Клики по бренду",
};

function shortLabel(eventType: string): string {
  const full = STEP_LABELS[eventType] || eventType;
  return full.length > 14 ? `${full.slice(0, 13)}…` : full;
}

export default function AdminEventsAnalyticsPage() {
  const [preset, setPreset] = useState<Preset>(30);
  const [toDate, setToDate] = useState(() => toDateInput(new Date()));
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return toDateInput(d);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<FunnelPayload | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topBrands, setTopBrands] = useState<TopBrand[]>([]);

  useEffect(() => {
    const now = new Date();
    const from = new Date();
    from.setUTCDate(now.getUTCDate() - preset);
    setToDate(toDateInput(now));
    setFromDate(toDateInput(from));
  }, [preset]);

  const load = async () => {
    setLoading(true);
    setError(null);

    const from = toIsoDayStart(fromDate);
    const to = toIsoDayEnd(toDate);

    try {
      const [funnelRes, topRes, topBrandsRes] = await Promise.all([
        fetch(`/api/admin/events/funnel?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
          cache: "no-store",
        }),
        fetch(
          `/api/admin/events/top-products?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=20`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/admin/events/top-brands?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=20`,
          { cache: "no-store" }
        ),
      ]);

      const funnelData = await funnelRes.json().catch(() => ({}));
      const topData = await topRes.json().catch(() => ({}));
      const topBrandsData = await topBrandsRes.json().catch(() => ({}));

      if (!funnelRes.ok || !funnelData?.success) {
        throw new Error(funnelData?.message || "Не удалось загрузить воронку");
      }
      if (!topRes.ok || !topData?.success) {
        throw new Error(topData?.message || "Не удалось загрузить топ товаров");
      }
      if (!topBrandsRes.ok || !topBrandsData?.success) {
        throw new Error(topBrandsData?.message || "Не удалось загрузить топ брендов");
      }

      setFunnel(funnelData.funnel || null);
      setTopProducts(Array.isArray(topData.items) ? topData.items : []);
      setTopBrands(Array.isArray(topBrandsData.items) ? topBrandsData.items : []);
    } catch (e: any) {
      setError(e?.message || "Ошибка загрузки аналитики");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const stepMax = useMemo(() => {
    const values = (funnel?.steps || []).map((step) => step.events);
    return Math.max(1, ...values);
  }, [funnel]);

  const pieData = useMemo(() => {
    const source = (funnel?.steps || []).filter((step) => step.events > 0);
    const total = source.reduce((acc, item) => acc + item.events, 0);
    if (!source.length || total <= 0) {
      return {
        total,
        items: [] as Array<{
          eventType: string;
          label: string;
          value: number;
          percent: number;
          color: string;
          from: number;
          to: number;
        }>,
        conic: "",
      };
    }

    let cursor = 0;
    const items = source.map((step, index) => {
      const percent = (step.events / total) * 100;
      const from = cursor;
      const to = Math.min(100, cursor + percent);
      cursor = to;
      return {
        eventType: step.eventType,
        label: STEP_LABELS[step.eventType] || step.eventType,
        value: step.events,
        percent,
        color: EVENT_COLORS[index % EVENT_COLORS.length],
        from,
        to,
      };
    });

    const conic = items
      .map((item) => `${item.color} ${item.from.toFixed(2)}% ${item.to.toFixed(2)}%`)
      .join(", ");

    return { total, items, conic };
  }, [funnel]);

  const topChart = useMemo(() => {
    const rows = topProducts.slice(0, 8);
    const maxPurchases = Math.max(1, ...rows.map((row) => row.purchases));
    return { rows, maxPurchases };
  }, [topProducts]);

  const topBrandChart = useMemo(() => {
    const rows = topBrands.slice(0, 8);
    const maxScore = Math.max(1, ...rows.map((row) => row.weightedScore));
    return { rows, maxScore };
  }, [topBrands]);

  const funnelChart = useMemo(() => {
    const rows = funnel?.steps || [];
    const max = Math.max(1, ...rows.map((row) => row.events));
    return { rows, max };
  }, [funnel]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Аналитика событий</h2>
          <p className="mt-1 text-xs text-black/50">
            Данные из Java event-analytics-service: воронка конверсии и топ товаров.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition"
            disabled={loading}
          >
            {loading ? "Обновление..." : "Обновить"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                onClick={() => setPreset(n as Preset)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                  preset === n
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-white text-black hover:bg-black hover:text-white"
                }`}
              >
                {n} дней
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border border-black/10 px-3 py-2 text-xs"
            />
            <span className="text-xs text-black/40">—</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border border-black/10 px-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(funnel?.steps || []).slice(0, 4).map((step) => (
          <div key={step.eventType} className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-xs text-black/55">
              {STEP_LABELS[step.eventType] || step.eventType}
            </div>
            <div className="mt-2 text-2xl font-bold">{formatNumber(step.events)}</div>
            <div className="mt-1 text-xs text-black/45">
              Конверсия от прошлого шага: {formatPercent(step.conversionFromPrevious)}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Воронка конверсии</h3>
            <p className="text-xs text-black/50">
              Общая конверсия view → purchase: {formatPercent(funnel?.overallConversion)}
            </p>
          </div>
        </div>

        {funnel?.steps?.length ? (
          <div className="space-y-3">
            {funnel.steps.map((step) => {
              const width = Math.max(4, Math.round((step.events / stepMax) * 100));
              return (
                <div key={step.eventType} className="rounded-xl border border-black/10 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {STEP_LABELS[step.eventType] || step.eventType}
                    </span>
                    <span className="text-black/60">
                      {formatNumber(step.events)} · {formatPercent(step.conversionFromPrevious)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-black transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-black/50">Нет данных за выбранный период.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
          <h3 className="text-sm font-semibold">График шагов воронки</h3>
          <p className="mt-1 text-xs text-black/50">Сравнение абсолютного объёма событий по шагам.</p>
          {funnelChart.rows.length ? (
            <div className="mt-4">
              <svg viewBox="0 0 760 260" className="w-full h-auto">
                <line x1="30" y1="220" x2="730" y2="220" stroke="#d4d4d8" strokeWidth="1" />
                {funnelChart.rows.map((step, index) => {
                  const slot = 700 / funnelChart.rows.length;
                  const barWidth = Math.max(24, slot * 0.56);
                  const x = 30 + index * slot + (slot - barWidth) / 2;
                  const barHeight = (step.events / funnelChart.max) * 170;
                  const y = 220 - barHeight;
                  return (
                    <g key={step.eventType}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx="8"
                        fill={EVENT_COLORS[index % EVENT_COLORS.length]}
                        opacity="0.9"
                      />
                      <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="10" fill="#111827">
                        {formatNumber(step.events)}
                      </text>
                      <text x={x + barWidth / 2} y="238" textAnchor="middle" fontSize="10" fill="#52525b">
                        {shortLabel(step.eventType)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <p className="mt-4 text-sm text-black/50">Нет данных для графика.</p>
          )}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
          <h3 className="text-sm font-semibold">Pie диаграмма событий</h3>
          <p className="mt-1 text-xs text-black/50">Доля каждого шага в общем объёме событий.</p>
          {pieData.items.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-[220px,1fr] sm:items-center">
              <div className="mx-auto relative h-52 w-52">
                <div
                  className="h-full w-full rounded-full border border-black/10"
                  style={{ background: `conic-gradient(${pieData.conic})` }}
                />
                <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/10 bg-white flex items-center justify-center text-xs font-semibold text-black/70">
                  {formatNumber(pieData.total)}
                </div>
              </div>
              <div className="space-y-2">
                {pieData.items.map((item) => (
                  <div
                    key={item.eventType}
                    className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.label}</span>
                    </div>
                    <div className="text-black/60">
                      {item.percent.toFixed(1)}% · {formatNumber(item.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-black/50">Нет данных для pie диаграммы.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-semibold">График топ-товаров по покупкам</h3>
        <p className="mt-1 text-xs text-black/50">Top 8 товаров по количеству событий PURCHASE.</p>
        {topChart.rows.length ? (
          <div className="mt-4 space-y-3">
            {topChart.rows.map((item) => {
              const width = Math.max(6, Math.round((item.purchases / topChart.maxPurchases) * 100));
              return (
                <div key={item.productId}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">Product #{item.productId}</span>
                    <span className="text-black/60">
                      {formatNumber(item.purchases)} покупок · {formatNumber(item.addToCart)} в корзину · {formatNumber(item.views)} просмотров
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-black to-black/60"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-black/50">Нет данных для графика.</p>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-semibold">Топ брендов по вовлечённости</h3>
        <p className="mt-1 text-xs text-black/50">
          Учитываются просмотры, добавления в корзину, покупки и клики по брендам.
        </p>

        {topBrandChart.rows.length ? (
          <div className="mt-4 space-y-3">
            {topBrandChart.rows.map((item) => {
              const width = Math.max(6, Math.round((item.weightedScore / topBrandChart.maxScore) * 100));
              return (
                <div key={item.brandId}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{item.brandName}</span>
                    <span className="text-black/60">
                      score {item.weightedScore.toFixed(1)} · {formatNumber(item.purchases)} покупок · {formatNumber(item.brandClicks)} кликов
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0f172a] to-[#2563eb]"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-black/50">Нет данных по брендам за выбранный период.</p>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-semibold">Топ товаров по событиям</h3>
        <p className="mt-1 text-xs text-black/50">
          Сортировка по покупкам, затем по добавлениям в корзину.
        </p>

        {topProducts.length === 0 ? (
          <p className="mt-4 text-sm text-black/50">Нет данных по товарам за выбранный период.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-black/55">
                  <th className="px-2 py-2 font-medium">Product ID</th>
                  <th className="px-2 py-2 font-medium">Просмотры</th>
                  <th className="px-2 py-2 font-medium">В корзину</th>
                  <th className="px-2 py-2 font-medium">Покупки</th>
                  <th className="px-2 py-2 font-medium">View → Cart</th>
                  <th className="px-2 py-2 font-medium">Cart → Purchase</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((item) => (
                  <tr key={item.productId} className="border-t border-black/10">
                    <td className="px-2 py-2 font-semibold">{item.productId}</td>
                    <td className="px-2 py-2">{formatNumber(item.views)}</td>
                    <td className="px-2 py-2">{formatNumber(item.addToCart)}</td>
                    <td className="px-2 py-2">{formatNumber(item.purchases)}</td>
                    <td className="px-2 py-2">{formatPercent(item.viewToCartConversion)}</td>
                    <td className="px-2 py-2">{formatPercent(item.cartToPurchaseConversion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
