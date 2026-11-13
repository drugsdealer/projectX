"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { upload } from "@imagekit/next";
import { deliveryMethodLabel } from "@/lib/delivery";
import { getOptimizedImageUrl, toProxiedImageUrl } from "@/lib/media";
import { getImageKitAuth } from "@/components/admin/ImageKitUploadField";

/*
  Раздел «Заказы».
  Заказ считается выполненным, когда к каждой неотменённой позиции приложен
  чек закупки (фото или PDF). Позицию можно отменить, если товара нет:
  перед этим админка напоминает связаться с клиентом и оформить возврат.
*/

type Item = {
  id: number;
  productId: number | null;
  name: string;
  price: number;
  quantity: number;
  size: string | null;
  image: string | null;
  receiptUrl: string | null;
  receiptName: string | null;
  receiptType: string | null;
  receiptAddedAt: string | null;
  receiptAddedBy: string | null;
  canceledAt: string | null;
  canceledBy: string | null;
  cancelComment: string | null;
};

type Order = {
  id: number;
  publicNumber: string | null;
  totalAmount: number;
  status: "PENDING" | "SUCCEEDED" | "CANCELED";
  shippingStatus: string;
  createdAt: string;
  paidAt: string | null;
  handedAt: string | null;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  comment: string | null;
  deliveryMethod: string | null;
  cancelReason: string | null;
  User: { id: number; email: string; fullName: string } | null;
  OrderItem: Item[];
};

type Filter = "work" | "done" | "unpaid" | "canceled" | "all";

const SHIPPING_LABELS: Record<string, string> = {
  PROCESSING: "Обработка заказа",
  ABROAD: "Товар за границей",
  IN_RUSSIA: "Товар в России",
  ARRIVED: "Заказ приехал",
};

const MAX_RECEIPT_SIZE = 15 * 1024 * 1024;

const rub = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU")} ₽`;
const dateTime = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

function progressOf(o: Order) {
  const active = o.OrderItem.filter((i) => !i.canceledAt);
  const withReceipt = active.filter((i) => i.receiptUrl).length;
  const allCanceled = o.OrderItem.length > 0 && active.length === 0;
  const fulfilled = o.status === "SUCCEEDED" && active.length > 0 && withReceipt === active.length;
  return { active: active.length, withReceipt, allCanceled, fulfilled, canceledCount: o.OrderItem.length - active.length };
}

function matchesFilter(o: Order, f: Filter) {
  const p = progressOf(o);
  switch (f) {
    case "work":
      return o.status === "SUCCEEDED" && !p.fulfilled && !p.allCanceled;
    case "done":
      return p.fulfilled;
    case "unpaid":
      return o.status === "PENDING";
    case "canceled":
      return o.status === "CANCELED" || p.allCanceled;
    default:
      return true;
  }
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("work");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ order: Order; item: Item } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.message || "Ошибка");
      setOrders(data.orders || []);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Обновляем одну позицию на месте, не перезагружая весь список
  const patchItem = useCallback((orderId: number, itemId: number, patch: Partial<Item>) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id !== orderId ? o : { ...o, OrderItem: o.OrderItem.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
      )
    );
  }, []);

  const itemAction = useCallback(
    async (orderId: number, itemId: number, payload: Record<string, unknown>) => {
      const res = await fetch("/api/admin/orders/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.message || "Не удалось сохранить");
      if (data.item) patchItem(orderId, itemId, data.item);
    },
    [patchItem]
  );

  const updateShipping = async (id: number, shippingStatus: string) => {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, shippingStatus }),
    });
    if (res.ok) setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, shippingStatus } : o)));
  };

  const markHanded = async (id: number) => {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "handed" }),
    });
    if (res.ok) setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, handedAt: new Date().toISOString() } : o)));
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { work: 0, done: 0, unpaid: 0, canceled: 0, all: orders.length };
    for (const o of orders) {
      (["work", "done", "unpaid", "canceled"] as Filter[]).forEach((f) => {
        if (matchesFilter(o, f)) c[f] += 1;
      });
    }
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return orders.filter((o) => {
      if (!matchesFilter(o, filter)) return false;
      if (!q) return true;
      const hay = [o.publicNumber, String(o.id), o.fullName, o.email].join(" ").toLowerCase();
      if (hay.includes(q)) return true;
      return digits.length >= 4 && o.phone.replace(/\D/g, "").includes(digits);
    });
  }, [orders, filter, query]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "work", label: "Ждут чеков" },
    { key: "done", label: "Выполнены" },
    { key: "unpaid", label: "Не оплачены" },
    { key: "canceled", label: "Отменены" },
    { key: "all", label: "Все" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Заказы</h2>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Номер, ФИО, телефон, почта"
            className="w-64 rounded-full border border-black/10 bg-white px-4 py-1.5 text-xs outline-none focus:border-black/30"
          />
          <button
            onClick={load}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold transition hover:bg-black hover:text-white"
          >
            Обновить
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.key ? "border-black bg-black text-white" : "border-black/10 bg-white hover:border-black/30"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 ${filter === f.key ? "text-white/60" : "text-black/40"}`}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="mt-6 text-sm text-black/60">Загрузка…</div>
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center text-sm text-black/50">
          {query ? "Ничего не нашлось." : filter === "work" ? "Все оплаченные заказы закрыты чеками." : "Здесь пока пусто."}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {visible.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              open={openId === o.id}
              onToggle={() => setOpenId((cur) => (cur === o.id ? null : o.id))}
              onItemAction={itemAction}
              onAskCancel={(item) => setCancelTarget({ order: o, item })}
              onShipping={updateShipping}
              onHanded={markHanded}
            />
          ))}
        </div>
      )}

      <CancelItemModal
        target={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async (comment) => {
          if (!cancelTarget) return;
          await itemAction(cancelTarget.order.id, cancelTarget.item.id, { action: "cancel", comment });
          setCancelTarget(null);
        }}
      />
    </div>
  );
}

/* ---------------- карточка заказа ---------------- */

function OrderCard({
  order: o,
  open,
  onToggle,
  onItemAction,
  onAskCancel,
  onShipping,
  onHanded,
}: {
  order: Order;
  open: boolean;
  onToggle: () => void;
  onItemAction: (orderId: number, itemId: number, payload: Record<string, unknown>) => Promise<void>;
  onAskCancel: (item: Item) => void;
  onShipping: (id: number, status: string) => void;
  onHanded: (id: number) => void;
}) {
  const p = progressOf(o);
  const number = o.publicNumber || `#${o.id}`;

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition ${open ? "border-black/20 shadow-sm" : "border-black/10"}`}>
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 text-left">
        <div className="min-w-[120px]">
          <div className="text-sm font-bold">{number}</div>
          <div className="text-[11px] text-black/40">{dateTime(o.createdAt)}</div>
        </div>
        <div className="min-w-[180px] flex-1">
          <div className="text-sm font-semibold">{o.fullName || "Без имени"}</div>
          <div className="text-xs text-black/50">{o.phone || o.email}</div>
        </div>
        <div className="text-sm font-semibold">{rub(o.totalAmount)}</div>
        <PaymentPill status={o.status} />
        <ReceiptProgress order={o} />
        <span className={`text-black/30 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="grid gap-5 border-t border-black/5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              {/* позиции */}
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Товары</h3>
                  {p.active > 0 && (
                    <span className="text-xs text-black/45">
                      Чеков: {p.withReceipt} из {p.active}
                      {p.canceledCount > 0 && ` · отменено: ${p.canceledCount}`}
                    </span>
                  )}
                </div>
                {o.OrderItem.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    orderPaid={o.status === "SUCCEEDED"}
                    onAction={(payload) => onItemAction(o.id, it.id, payload)}
                    onAskCancel={() => onAskCancel(it)}
                  />
                ))}
              </div>

              {/* клиент и доставка */}
              <div className="space-y-4">
                <section className="rounded-xl bg-black/[0.03] p-4 text-sm">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Клиент</h3>
                  <Row label="ФИО" value={o.fullName} />
                  <Row label="Телефон" value={o.phone} href={o.phone ? `tel:${o.phone.replace(/[^\d+]/g, "")}` : undefined} copy />
                  <Row label="Почта" value={o.email} href={o.email ? `mailto:${o.email}` : undefined} copy />
                  <Row label="Аккаунт" value={o.User ? `${o.User.email} (id ${o.User.id})` : "Гость"} />
                </section>

                <section className="rounded-xl bg-black/[0.03] p-4 text-sm">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Доставка</h3>
                  <Row label="Способ" value={deliveryMethodLabel(o.deliveryMethod)} />
                  <Row label="Адрес" value={o.address} />
                  {o.comment && <Row label="Комментарий" value={o.comment} />}
                  <div className="mt-3">
                    <select
                      value={o.shippingStatus}
                      onChange={(e) => onShipping(o.id, e.target.value)}
                      className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
                    >
                      {Object.keys(SHIPPING_LABELS).map((s) => (
                        <option key={s} value={s}>
                          {SHIPPING_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    {o.handedAt ? (
                      <div className="mt-2 text-xs text-emerald-700">Отдан {dateTime(o.handedAt)}</div>
                    ) : o.shippingStatus === "ARRIVED" ? (
                      <button
                        onClick={() => onHanded(o.id)}
                        className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold transition hover:bg-black hover:text-white"
                      >
                        Отметить: заказ отдан
                      </button>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-xl bg-black/[0.03] p-4 text-sm">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Оплата</h3>
                  <Row label="Сумма" value={rub(o.totalAmount)} />
                  <Row label="Оплачен" value={o.paidAt ? dateTime(o.paidAt) : "—"} />
                  {o.status === "CANCELED" && o.cancelReason && <Row label="Причина" value={o.cancelReason} />}
                </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, href, copy }: { label: string; value?: string | null; href?: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="shrink-0 text-xs text-black/45">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right">
        {href ? (
          <a href={href} className="break-all font-medium underline-offset-2 hover:underline">
            {value}
          </a>
        ) : (
          <span className="break-words font-medium">{value}</span>
        )}
        {copy && (
          <button
            type="button"
            title="Скопировать"
            onClick={() => {
              navigator.clipboard?.writeText(value).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              });
            }}
            className="text-[11px] text-black/35 hover:text-black"
          >
            {copied ? "✓" : "⧉"}
          </button>
        )}
      </span>
    </div>
  );
}

function PaymentPill({ status }: { status: Order["status"] }) {
  const map = {
    SUCCEEDED: ["Оплачен", "bg-emerald-50 text-emerald-700 border-emerald-200"],
    PENDING: ["Не оплачен", "bg-amber-50 text-amber-700 border-amber-200"],
    CANCELED: ["Отменён", "bg-stone-100 text-stone-500 border-stone-200"],
  } as const;
  const [label, cls] = map[status] ?? map.PENDING;
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function ReceiptProgress({ order }: { order: Order }) {
  const p = progressOf(order);
  if (order.status !== "SUCCEEDED") return null;
  if (p.allCanceled) {
    return <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-500">Все позиции отменены</span>;
  }
  if (p.fulfilled) {
    return <span className="rounded-full bg-black px-2.5 py-0.5 text-[11px] font-semibold text-white">✓ Выполнен</span>;
  }
  const pct = p.active ? Math.round((p.withReceipt / p.active) * 100) : 0;
  return (
    <span className="flex items-center gap-2 text-[11px] font-semibold text-black/55">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10">
        <span className="block h-full rounded-full bg-black transition-all" style={{ width: `${pct}%` }} />
      </span>
      Чеки {p.withReceipt}/{p.active}
    </span>
  );
}

/* ---------------- позиция заказа ---------------- */

function ItemRow({
  item,
  orderPaid,
  onAction,
  onAskCancel,
}: {
  item: Item;
  orderPaid: boolean;
  onAction: (payload: Record<string, unknown>) => Promise<void>;
  onAskCancel: () => void;
}) {
  const canceled = Boolean(item.canceledAt);
  const qty = Math.max(1, Number(item.quantity) || 1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await onAction(payload);
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border p-3 transition ${canceled ? "border-stone-200 bg-stone-50" : "border-black/10 bg-white"}`}>
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image ? getOptimizedImageUrl(item.image, { width: 160 }) : "/img/placeholder.svg"}
          alt=""
          className={`h-16 w-16 shrink-0 rounded-lg border border-black/5 object-cover ${canceled ? "grayscale opacity-60" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium leading-snug ${canceled ? "text-stone-400 line-through" : ""}`}>{item.name}</div>
          <div className="mt-0.5 text-xs text-black/45">
            {item.size && item.size !== "N/A" ? `Размер ${item.size} · ` : ""}
            {qty} шт · {rub(item.price * qty)}
          </div>
          {canceled && (
            <div className="mt-1 text-xs text-stone-500">
              Отменён {dateTime(item.canceledAt)}
              {item.canceledBy ? ` · ${item.canceledBy}` : ""}
              {item.cancelComment ? ` · «${item.cancelComment}»` : ""}
            </div>
          )}
        </div>
        {!canceled ? (
          <button
            type="button"
            onClick={onAskCancel}
            title="Отменить позицию"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 text-sm text-black/40 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            ✕
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: "restore" })}
            className="h-7 shrink-0 rounded-full border border-black/10 px-3 text-[11px] font-semibold text-black/50 transition hover:bg-black hover:text-white"
          >
            Вернуть
          </button>
        )}
      </div>

      {!canceled && (
        <div className="mt-3 border-t border-black/5 pt-3">
          {item.receiptUrl ? (
            <ReceiptView item={item} busy={busy} onRemove={() => run({ action: "removeReceipt" })} onReplace={(p) => run(p)} />
          ) : (
            <ReceiptUpload disabled={!orderPaid || busy} hint={orderPaid ? undefined : "Чек прикладывается после оплаты"} onUploaded={(p) => run(p)} />
          )}
        </div>
      )}
      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
    </div>
  );
}

function ReceiptView({
  item,
  busy,
  onRemove,
  onReplace,
}: {
  item: Item;
  busy: boolean;
  onRemove: () => void;
  onReplace: (payload: Record<string, unknown>) => void;
}) {
  const href = toProxiedImageUrl(item.receiptUrl) || item.receiptUrl || "#";
  const isPdf = item.receiptType === "pdf";
  return (
    <div className="flex items-center gap-3">
      <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0">
        {isPdf ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-black/10 bg-red-50 text-[11px] font-bold text-red-600">
            PDF
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getOptimizedImageUrl(item.receiptUrl, { width: 120 })} alt="Чек" className="h-12 w-12 rounded-lg border border-black/10 object-cover" />
        )}
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">✓ Чек приложен</div>
        <div className="truncate text-[11px] text-black/40">
          {item.receiptName || (isPdf ? "документ.pdf" : "фото")} · {dateTime(item.receiptAddedAt)}
          {item.receiptAddedBy ? ` · ${item.receiptAddedBy}` : ""}
        </div>
      </div>
      <ReceiptUpload compact disabled={busy} onUploaded={onReplace} />
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-black/40 transition hover:text-red-600"
      >
        Убрать
      </button>
    </div>
  );
}

function ReceiptUpload({
  disabled,
  hint,
  compact,
  onUploaded,
}: {
  disabled?: boolean;
  hint?: string;
  compact?: boolean;
  onUploaded: (payload: Record<string, unknown>) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handle = async (file: File | null) => {
    setErr(null);
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf && !file.type.startsWith("image/")) {
      setErr("Нужен файл изображения или PDF");
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setErr("Файл больше 15 МБ");
      return;
    }
    setProgress(0);
    try {
      const auth = await getImageKitAuth();
      const safe = file.name.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "_") || `receipt-${Date.now()}`;
      const result = await upload({
        file,
        fileName: safe,
        folder: "/stage/order-receipts",
        useUniqueFileName: true,
        publicKey: auth.publicKey,
        token: auth.token,
        expire: auth.expire,
        signature: auth.signature,
        onProgress: (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      if (!result.url) throw new Error("Хранилище не вернуло ссылку на файл");
      onUploaded({ action: "receipt", url: result.url, name: file.name, type: isPdf ? "pdf" : "image" });
    } catch (e: any) {
      setErr(e?.message || "Не удалось загрузить");
    } finally {
      setProgress(null);
      if (ref.current) ref.current.value = "";
    }
  };

  const uploading = progress !== null;

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
      />
      {compact ? (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => ref.current?.click()}
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-black/40 transition hover:text-black disabled:opacity-40"
        >
          {uploading ? `${progress}%` : "Заменить"}
        </button>
      ) : (
        <div>
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => ref.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-black/20 px-3 py-2.5 text-xs font-semibold text-black/60 transition hover:border-black/50 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                Загрузка {progress}%
              </>
            ) : (
              <>＋ Приложить чек — фото или PDF</>
            )}
          </button>
          {hint && <div className="mt-1 text-center text-[11px] text-black/35">{hint}</div>}
        </div>
      )}
      {err && <div className="mt-1 text-[11px] text-red-600">{err}</div>}
    </>
  );
}

/* ---------------- подтверждение отмены позиции ---------------- */

function CancelItemModal({
  target,
  onClose,
  onConfirm,
}: {
  target: { order: Order; item: Item } | null;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
}) {
  const [agreed, setAgreed] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setAgreed(false);
      setComment("");
      setErr(null);
    }
  }, [target]);

  const o = target?.order;
  const it = target?.item;
  const refund = it ? it.price * Math.max(1, Number(it.quantity) || 1) : 0;
  const phoneHref = o?.phone ? `tel:${o.phone.replace(/[^\d+]/g, "")}` : undefined;

  return (
    <AnimatePresence>
      {target && o && it && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-extrabold tracking-[-0.02em]">Отменить этот товар?</h3>
            <p className="mt-1 text-sm text-black/55">
              «{it.name}»{it.size && it.size !== "N/A" ? `, размер ${it.size}` : ""} — {rub(refund)}
            </p>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">Сначала свяжитесь с клиентом</div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-amber-900/60">ФИО</span>
                  <span className="text-right font-semibold text-amber-950">{o.fullName || "не указано"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-amber-900/60">Телефон</span>
                  {phoneHref ? (
                    <a href={phoneHref} className="font-semibold text-amber-950 underline underline-offset-2">
                      {o.phone}
                    </a>
                  ) : (
                    <span className="font-semibold text-amber-950">не указан</span>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-amber-900/80">
                Сообщите, что этого товара сейчас нет, и оформите возврат за эту позицию — {rub(refund)}. Отменяйте
                только после этого. Если в заказе есть другие товары, они остаются в работе.
              </p>
            </div>

            <label className="mt-4 block">
              <span className="text-xs text-black/50">Комментарий (по желанию)</span>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Например: нет размера у поставщика"
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
            </label>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-black" />
              <span>Я связался с клиентом и оформил возврат за этот товар</span>
            </label>

            {err && <p className="mt-3 text-xs text-red-600">{err}</p>}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="flex-1 rounded-2xl border border-black/15 px-4 py-3 text-sm font-semibold transition hover:border-black/40"
              >
                Не отменять
              </button>
              <button
                type="button"
                disabled={!agreed || busy}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    await onConfirm(comment.trim());
                  } catch (e: any) {
                    setErr(e?.message || "Не удалось отменить");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {busy ? "Отменяем…" : "Отменить товар"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
