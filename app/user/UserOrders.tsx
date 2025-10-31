// app/user/UserOrders.tsx
'use client';

import React from 'react';
import { createPortal } from 'react-dom';
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
import Link from 'next/link';
import { useOrders } from "../../hooks/useOrders";

type OrderItem = {
  id: number;
  productId: number | null;
  productItemId?: number | null;
  name?: string | null;
  image?: string | null;
  price: number;
  quantity: number;
  size?: string | null;
  product?: {
    id: number;
    name?: string | null;
    imageUrl?: string | null;
    brandName?: string | null;
    brandLogoUrl?: string | null;
  } | null;
};

type Order = {
  id: number;
  publicNumber?: string | null;
  totalAmount: number;
  status: 'PENDING' | 'SUCCEEDED' | 'CANCELED';
  createdAt: string; // ISO string
  token?: string | null;
  items: OrderItem[];
};

const rub = new Intl.NumberFormat('ru-RU');
const fmt = (n: number) => rub.format(Number(n) || 0);

const safeDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// --- Brand helpers ---
function guessBrandName(name?: string | null): string | null {
  if (!name) return null;
  const n = name.trim();
  // take part before first space or before ` x ` collaboration mark
  const byX = n.split(/\sx\s/i)[0];
  const firstToken = byX.split(/\s+/)[0];
  return firstToken?.slice(0, 24) || null;
}

function initials(str?: string | null) {
  if (!str) return '';
  return str
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

function BrandBadge({ name, logo }: { name?: string | null; logo?: string | null }) {
  const text = name || null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-black/10 bg-white overflow-hidden">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={text || 'brand'} className="w-full h-full object-contain" />
        ) : (
          <span className="text-[10px] font-semibold text-gray-700">
            {initials(text) || '•'}
          </span>
        )}
      </span>
      {text ? <span className="font-medium">{text}</span> : null}
    </span>
  );
}

// --- UI helpers ---
function StatusPill({ status }: { status: Order['status'] }) {
  const color =
    status === 'SUCCEEDED'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : status === 'PENDING'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-rose-100 text-rose-700 border-rose-200';

  const text =
    status === 'SUCCEEDED'
      ? 'Оплачен'
      : status === 'PENDING'
      ? 'В обработке'
      : 'Отменён';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {text}
    </span>
  );
}

function OrderSkeleton() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-40 bg-black/10 rounded" />
        <div className="h-6 w-20 bg-black/10 rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-16 h-16 bg-black/10 rounded-md" />
            <div className="flex-1">
              <div className="h-4 w-24 bg-black/10 rounded mb-2" />
              <div className="h-3 w-16 bg-black/10 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 h-4 w-24 bg-black/10 rounded" />
    </div>
  );
}

// --- Step tracker (simple, no external libs) ---
const STEP_LABELS = [
  'Обработка заказа',
  'Товар за границей',
  'Товар в России',
  'Заказ приехал',
] as const;
const STEP_ICONS = ['🧾', '✈️', '🚚', '📦'] as const;

type StepTrackerProps = {
  activeIndex: number; // 0..3
};

function StepTracker({ activeIndex }: StepTrackerProps) {
  return (
    <div className="w-full">
      <div className="flex gap-3 items-stretch overflow-x-auto sm:overflow-visible snap-x snap-mandatory -mx-4 px-4 pb-1 whitespace-nowrap">
        {STEP_LABELS.map((label, idx) => {
          const done = idx < activeIndex;
          const active = idx === activeIndex;
          const baseDot = 'flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm';
          const dotClass = active
            ? 'bg-black text-white'
            : done
            ? 'bg-emerald-500 text-white'
            : 'bg-white text-gray-400 border border-black/15';
          const lineClass = done ? 'bg-emerald-500' : active ? 'bg-black' : 'bg-black/10';
          return (
            <div key={label} className="snap-center shrink-0 min-w-[220px] sm:min-w-0 sm:flex-1 flex items-center gap-2">
              <div className={[baseDot, dotClass].join(' ')} title={label}>
                <span className={done && !active ? 'opacity-90' : ''}>{STEP_ICONS[idx]}</span>
              </div>
              <div className={[
                'text-sm sm:text-base',
                active ? 'font-semibold text-black' : done ? 'text-emerald-700' : 'text-gray-500',
              ].join(' ')}>
                {label}
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div className={['h-[3px] flex-1 rounded-full hidden sm:block', lineClass].join(' ')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Heuristic mapping: показываем только то, что уже известно сейчас
// - CANCELED: отдельный сценарий
// - PENDING: шаг 0 "Обработка заказа"
// - SUCCEEDED: считаем "В пути" внутри РФ => ставим шаг 2 (можно скорректировать логикой доставки в будущем)
function deriveStage(order: Order) {
  if (order.status === 'CANCELED') {
    return { index: 0, hint: 'Заказ отменён' };
  }
  if (order.status === 'PENDING') {
    return { index: 0, hint: 'Заказ в обработке' };
  }
  // SUCCEEDED
  return { index: 2, hint: 'Сейчас: в пути по РФ' };
}

// --- SupportPanel ---
function SupportPanel({ orderNumber }: { orderNumber: string | number }) {
  const [copied, setCopied] = React.useState(false);
  const [pageUrl, setPageUrl] = React.useState<string>('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setPageUrl(window.location.href);
      } catch {
        setPageUrl('');
      }
    }
  }, []);

  const copy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(orderNumber));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // ignore clipboard errors (HTTP context, unsupported browser, etc.)
    }
  };
  return (
    <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.06] p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="text-sm text-gray-800 flex items-center gap-2">
          <span className="text-lg">💬</span>
          <span>
            Нужна помощь с заказом? Мы на связи 24/7. Укажите номер заказа и опишите вопрос — ответим в течение пары минут.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copy} className="px-3 py-1.5 rounded-lg border border-black/10 bg-white hover:bg-black/[0.04] text-sm">
            № заказа: {orderNumber} {copied ? '✓' : '⧉'}
          </button>
          <a href={`/support?orderId=${orderNumber}`} className="px-3 py-1.5 rounded-lg bg-black text-white hover:bg-black/90 text-sm">Открыть чат</a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent('Вопрос по заказу № ' + orderNumber)}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg border border-black text-black hover:bg-black hover:text-white text-sm"
          >
            Telegram
          </a>
          <a href={`mailto:support@stagestore.local?subject=${encodeURIComponent('Вопрос по заказу № ' + orderNumber)}`} className="px-3 py-1.5 rounded-lg border border-black/10 bg-white hover:bg-black/[0.04] text-sm">Email</a>
        </div>
      </div>
    </div>
  );
}

// --- Modal with details ---
type ModalProps = {
  open: boolean;
  onClose: () => void;
  order: Order | null;
};

function OrderDetailsModal({ open, onClose, order }: ModalProps) {
  if (!open || !order) return null;

  const created = safeDate(order.createdAt);
  const stage = deriveStage(order);
  const items = Array.isArray(order.items) ? order.items : [];
  const displayNumber = order.publicNumber ?? order.id;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[2000] flex items-start justify-center p-2 sm:p-4 md:p-8"
        role="dialog"
        aria-modal="true"
      >
        {/* backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        {/* panel */}
        <div className="relative z-[2001] w-full max-w-[min(100vw-0.5rem,1100px)] mx-auto bg-white rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-1rem)] sm:h-[85vh]">
          {/* header */}
          <div className="p-4 sm:p-5 border-b border-black/10 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-gray-500">
                Заказ № {displayNumber} <span className="mx-2 text-gray-300">•</span>
                {created ? created.toLocaleDateString('ru-RU') : 'Дата неизвестна'}{' '}
                {created && (
                  <span className="text-gray-400">
                    {created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill status={order.status} />
                <span className="text-xs text-gray-500">{stage.hint}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm border border-black/10 hover:bg-black/5"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          {/* body */}
          <div className="p-4 sm:p-5 md:p-8 space-y-8 overflow-y-auto">
            {/* steps */}
            <div className="space-y-4">
              <h3 className="text-lg md:text-xl font-semibold">Статус доставки</h3>
              <StepTracker activeIndex={stage.index} />
            </div>

            {/* order info */}
            <div className="space-y-4">
              <h3 className="text-lg md:text-xl font-semibold">Информация о заказе</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                  <span className="text-gray-500">Номер заказа</span>
                  <span className="font-medium">{displayNumber}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                  <span className="text-gray-500">Дата оформления</span>
                  <span className="font-medium">
                    {created ? created.toLocaleDateString('ru-RU') : 'Дата неизвестна'}{' '}
                    {created &&
                      created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                  <span className="text-gray-500">Статус</span>
                  <span className="font-medium">{stage.hint}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                  <span className="text-gray-500">Способ оплаты</span>
                  <span className="font-medium">Онлайн‑оплата (мок‑банк)</span>
                </div>
              </div>
            </div>

            {/* items */}
            <div className="space-y-4">
              <h3 className="text-lg md:text-xl font-semibold">Состав заказа</h3>
              <div className="space-y-3">
                {items.map((it) => {
                  const pid = it.productId ?? it.product?.id ?? null;
                  const href = pid ? `/product/${pid}` : undefined;
                  const img = it.image || it.product?.imageUrl || '/img/placeholder.png';
                  const title = it.name || it.product?.name || 'Товар';
                  const rawSize =
                    it.size ??
                    (it as any)?.sizeLabel ??
                    null;
                  const sizeClean = rawSize && rawSize.toString().toUpperCase() !== 'N/A' ? rawSize : null;
                  const qty = Number(it.quantity) || 0;
                  const price = Number(it.price) || 0;
                  const subtotal = price * Math.max(1, qty);
                  const brandName = it.product?.brandName || guessBrandName(title);
                  const brandLogo = it.product?.brandLogoUrl || undefined;

                  const row = (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-black/5 p-4 hover:bg-black/[0.02]">
                      <img src={img} alt={title} className="w-full sm:w-24 h-40 sm:h-24 object-cover rounded-md border border-black/10" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <BrandBadge name={brandName || undefined} logo={brandLogo} />
                        </div>
                        <div className="text-sm md:text-base font-medium whitespace-normal leading-snug">{title}</div>
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <div>{sizeClean ? `Размер: ${sizeClean}` : 'Размер: —'}</div>
                          {qty > 1 && <div>Количество: {qty}</div>}
                        </div>
                      </div>
                      <div className="text-left sm:text-right min-w-[120px]">
                        <div className="text-sm text-gray-500">Цена</div>
                        <div className="text-base md:text-lg font-semibold">{fmt(subtotal)} ₽</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {qty > 1 ? (
                            <>
                              <span className="font-semibold text-black">{fmt(subtotal)} ₽</span>
                              <span className="text-gray-400"> · {qty} × {fmt(price)} ₽</span>
                            </>
                          ) : (
                            <span className="font-semibold text-black">{fmt(subtotal)} ₽</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <div key={it.id}>{href ? <Link href={href} prefetch={false} className="block">{row}</Link> : row}</div>
                  );
                })}
              </div>
            </div>

            {/* summary + help */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Текущий этап: <span className="font-semibold">{STEP_LABELS[stage.index]}</span>
              </div>
              <div className="text-xl md:text-2xl font-semibold">Итого к оплате: {fmt(order.totalAmount)} ₽</div>
            </div>

            <SupportPanel orderNumber={displayNumber} />
          </div>
        </div>
      </div>
    </Portal>
  );
}

export default function UserOrders() {
  const { orders: rawOrders, unauth, isLoading, isError, reload } = useOrders();
  const orders = (Array.isArray(rawOrders) ? rawOrders : []) as Order[];

  // modal state
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <OrderSkeleton />
        <OrderSkeleton />
      </div>
    );
  }

  if (unauth) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
        <p className="text-gray-600 mb-4">Чтобы увидеть историю заказов, войдите в аккаунт.</p>
        <Link
          href="/login"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90"
        >
          Войти
        </Link>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        Не удалось загрузить заказы
        <div className="mt-4">
          <button
            onClick={reload}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-center text-gray-600">
        Заказов пока нет.
        <div className="mt-4">
          <Link
            href="/#footwear"
            className="inline-flex items-center px-4 py-2 rounded-lg border border-black text-black hover:bg-black hover:text-white"
          >
            Перейти в каталог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <div className="max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
          <div className="space-y-6">
            {orders.map((o) => {
              const created = safeDate(o.createdAt);
              const items = Array.isArray(o.items) ? o.items : [];
              const displayNumber = o.publicNumber ?? o.id;
              return (
                <div key={o.id} className="rounded-2xl bg-white/95 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div className="space-y-0.5">
                      <div className="text-sm text-gray-500">
                        Заказ № {displayNumber}{' '}
                        <span className="mx-2 text-gray-300">•</span>
                        {created ? created.toLocaleDateString('ru-RU') : 'Дата неизвестна'}{' '}
                        {created && (
                          <span className="text-gray-400">
                            {created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">Позиций: {items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={o.status} />
                      <div className="text-sm font-semibold">Итого: {fmt(o.totalAmount)} ₽</div>
                      <button
                        onClick={() => {
                          setSelectedOrder(o);
                          setDetailsOpen(true);
                        }}
                        className="px-3 py-1.5 text-sm rounded-lg border border-black hover:bg-black hover:text-white transition"
                      >
                        Подробнее
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {items.map((it) => {
                      const pid = it.productId ?? it.product?.id ?? null;
                      const href = pid ? `/product/${pid}` : undefined;
                      const img = it.image || it.product?.imageUrl || '/img/placeholder.png';
                      const title = it.name || it.product?.name || 'Товар';
                      const size = it.size ? `Размер: ${it.size}` : '';
                      const qty = Number(it.quantity) || 0;
                      const price = Number(it.price) || 0;
                      const subtotal = price * Math.max(1, qty);
                      const brandName = it.product?.brandName || guessBrandName(title);
                      const brandLogo = it.product?.brandLogoUrl || undefined;

                      const content = (
                        <div className="flex gap-3 rounded-xl border border-black/5 p-3 hover:bg-black/[0.03]">
                          <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img}
                              alt={title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <BrandBadge name={brandName || undefined} logo={brandLogo} />
                            </div>
                            <div className="text-sm font-medium whitespace-normal leading-snug">{title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {size}
                              {size && ' · '}×{qty}
                            </div>
                            <div className="text-sm font-semibold mt-1">
                              {fmt(subtotal)} ₽
                              {qty > 1 && <span className="text-gray-400 text-xs"> · {qty} × {fmt(price)} ₽</span>}
                            </div>
                          </div>
                        </div>
                      );

                      return (
                        <div key={it.id}>
                          {href ? (
                            <Link href={href} prefetch={false} className="block">
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <OrderDetailsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        order={selectedOrder}
      />
    </>
  );
}
