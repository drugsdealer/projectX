'use client';

import React, { useState, useEffect, useRef } from "react";
import { useCart } from "@/context/CartContext";
import { useDiscount } from "@/context/DiscountContext";
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import dynamic from "next/dynamic";
import { useUser } from "@/user/UserContext";
import { useRouter } from "next/navigation";

// --- Local Product shape (API-backed) ---
type Product = {
  id: number;
  name: string;
  price?: number | null;
  imageUrl?: string | null;
  images?: string[];
  premium?: boolean;
  badge?: string | null;
  category?: string | null;
  tags?: string[] | null;
  sizes?: any;
};

// Heuristic: determine "premium" tagging from available fields
const isPremiumProduct = (obj: any) =>
  !!(obj?.premium || obj?.badge === 'EXCLUSIVE' || obj?.category === 'premium' || obj?.tags?.includes?.('premium'));

function setCookie(name: string, value: string, maxAgeSec = 1800) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
  } catch {}
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/([.$?*|{}()\[\]\\/+^\-])/g, "\\$1")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function AuthGateModal({
  onClose,
  onLogin,
  onRegister,
}: {
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-[92%] max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)]">
        <div className="text-3xl">😊</div>
        <h3 className="mt-3 text-xl font-semibold">Войдите или зарегистрируйтесь</h3>
        <p className="mt-2 text-sm text-gray-600">
          Чтобы продолжить шоппинг и оформить заказ, нужен аккаунт.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onLogin}
            className="flex-1 rounded-xl bg-black text-white px-4 py-2.5 text-sm font-semibold"
          >
            Войти
          </button>
          <button
            onClick={onRegister}
            className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-black hover:bg-gray-50"
          >
            Регистрация
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full text-xs text-gray-500 hover:text-gray-700"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { cartItems, removeFromCart, postponedItems, setPostponedItems, togglePostponed, getPostponedKey } = useCart();
  const { discount, applyDiscount, resetDiscount } = useDiscount();
  const { showToast } = useToast();

  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [inputBounceTrigger, setInputBounceTrigger] = useState(0);
  const [applied, setApplied] = useState(false);
  const [promoError, setPromoError] = useState(false);
  const [promoErrorText, setPromoErrorText] = useState<string | null>(null);
  const [ownedPromos, setOwnedPromos] = useState<Array<{ code: string; type: "PERCENT" | "AMOUNT"; value: number }>>([]);
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [applyingPromo, setApplyingPromo] = useState<string | null>(null);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasCheckoutData, setHasCheckoutData] = useState(false);
  const { user } = useUser();
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [isBottomSummaryVisible, setIsBottomSummaryVisible] = useState(false);
  const [productMetaById, setProductMetaById] = useState<Record<number, { premium: boolean; brand: string | null }>>({});
  const [promoMeta, setPromoMeta] = useState<{
    appliesTo: "ALL" | "PREMIUM_ONLY" | "NON_PREMIUM_ONLY";
    excludedBrands: string[];
  } | null>(null);
  const hasDiscount =
    discount.type === "AMOUNT" ? discount.value > 0 : discount.value > 0;
  const getDiscountAmount = (subtotal: number) =>
    discount.type === "AMOUNT"
      ? discount.value
      : subtotal * discount.value;
  const getCartItemId = (it: any) => {
    const direct = Number(it?.cartItemId);
    if (Number.isFinite(direct)) return direct;
    const id = Number(it?.id);
    const productId = Number(it?.productId ?? it?.product?.id);
    if (Number.isFinite(id) && Number.isFinite(productId) && id !== productId) return id;
    return Number.isFinite(id) && !Number.isFinite(productId) ? id : null;
  };

  const normalizeBrand = (v?: string | null) => {
    if (!v) return null;
    const s = String(v).trim().toLowerCase();
    return s || null;
  };

  const ensureProductMeta = async (ids: number[]) => {
    const missing = ids.filter((id) => !(id in productMetaById));
    if (!missing.length) return {};
    try {
      const results = await Promise.all(
        missing.map(async (id) => {
          try {
            const res = await fetch(`/api/products/${id}`);
            if (!res.ok) return null;
            const data = await res.json().catch(() => null);
            const p = (data && (data.product || data)) || null;
            if (!p) return null;
            const premium = Boolean(p?.premium || p?.badge === "EXCLUSIVE" || p?.category === "premium");
            const brand = normalizeBrand(p?.Brand?.name ?? p?.brand?.name ?? p?.brand ?? p?.brandName ?? null);
            return { id, premium, brand };
          } catch {
            return null;
          }
        })
      );
      const next: Record<number, { premium: boolean; brand: string | null }> = {};
      results.forEach((r) => {
        if (r?.id) next[r.id] = { premium: r.premium, brand: r.brand };
      });
      if (Object.keys(next).length) {
        setProductMetaById((prev) => ({ ...prev, ...next }));
      }
      return next;
    } catch {}
    return {};
  };
  useEffect(() => {
    const savedCheckout = localStorage.getItem("checkoutState");
    if (savedCheckout) {
      setHasCheckoutData(true);
    }
  }, []);

  useEffect(() => {
    const ids = Array.from(new Set(cartItems.map((it: any) => Number(it?.productId ?? it?.id)).filter((n) => Number.isFinite(n) && n > 0)));
    if (!ids.length) return;
    ensureProductMeta(ids);
  }, [cartItems]);

  const CheckoutModal = dynamic(() => import("@/components/CheckoutModal"), { ssr: false });

  // Определение premium вынесено в isPremiumProduct(obj) выше

  const handleRemove = (index: number) => {
    const item = cartItems[index];
    if (item?.id != null) removeFromCart(item.id);
    if (cartItems.length === 1) {
      resetDiscount();
      setApplied(false);
    }
  };

useEffect(() => {
  (async () => {
    try {
      const raw = localStorage.getItem("recentlyViewed") || "[]";
      const ids = JSON.parse(raw);
      const list: number[] = Array.isArray(ids) ? ids.filter((v) => Number.isFinite(v)) : [];
      if (!list.length) {
        setRecentProducts([]);
        setLoadingRecent(false);
        return;
      }
      // Берём первые 6 и тянем по одному через /api/products/[id]
      const first = list.slice(0, 6);
      const results = await Promise.all(
        first.map(async (id: number) => {
          try {
            const res = await fetch(`/api/products/${id}`);
            if (!res.ok) return null;
            const data = await res.json().catch(() => null);
            // допускаем форму { product } или сам объект
            return (data && (data.product || data)) || null;
          } catch {
            return null;
          }
        })
      );
      const items = results.filter(Boolean) as Product[];
      setRecentProducts(items);
    } catch {
      setRecentProducts([]);
    } finally {
      setTimeout(() => setLoadingRecent(false), 300);
    }
  })();
}, []);

  // Загрузка состояния промокода из локального хранилища
  useEffect(() => {
    const storedPromo = localStorage.getItem("promoCode");
    const storedApplied = localStorage.getItem("promoApplied");
    const storedMeta = localStorage.getItem("promoMeta");
    if (storedPromo && storedApplied === "1") {
      setPromoCode(storedPromo);
      if (hasDiscount) setApplied(true);
    }
    if (storedMeta) {
      try {
        const parsed = JSON.parse(storedMeta);
        if (parsed?.appliesTo) setPromoMeta(parsed);
      } catch {}
    }
  }, [hasDiscount]);

  // Список активированных промокодов пользователя (хаотичный порядок)
  useEffect(() => {
    let cancelled = false;
    const shuffle = <T,>(arr: T[]) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    (async () => {
      if (!user || (user as any)?.isGuest) {
        setOwnedPromos([]);
        return;
      }
      setLoadingPromos(true);
      try {
        const res = await fetch("/api/promocodes/owned", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setOwnedPromos([]);
          return;
        }
        const data = await res.json().catch(() => ({} as any));
        const list = Array.isArray(data?.promoCodes) ? data.promoCodes : [];
        const mapped = list
          .filter((p: any) => p?.code)
          .map((p: any) => ({
            code: String(p.code),
            type: p.type === "AMOUNT" ? "AMOUNT" : "PERCENT",
            value: Number(p.value ?? 0) || 0,
          }));
        if (!cancelled) {
          setOwnedPromos(shuffle(mapped));
        }
      } catch {
        if (!cancelled) setOwnedPromos([]);
      } finally {
        if (!cancelled) setLoadingPromos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Сброс промокода, если корзина пуста
  useEffect(() => {
    if (cartItems.length === 0) {
      resetDiscount();
      setApplied(false);
      setPromoCode("");
      setPromoMeta(null);
      try { localStorage.removeItem("promoMeta"); localStorage.removeItem("promoApplied"); } catch {}
    }
  }, [cartItems]);

  useEffect(() => {
    const node = summaryRef.current;
    if (!node) {
      setIsBottomSummaryVisible(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBottomSummaryVisible(entry.isIntersecting);
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [cartItems.length]);


  const activeCartItems = cartItems.filter(item => !postponedItems.includes(getPostponedKey(item)));
  const isPromoEligible = (item: any) => {
    if (!promoMeta) return true;
    const meta = productMetaById[Number(item?.productId ?? item?.id)];
    const premium =
      typeof item?.premium === "boolean"
        ? item.premium
        : typeof meta?.premium === "boolean"
        ? meta.premium
        : null;
    const brand =
      normalizeBrand(item?.brand ?? item?.brandName ?? null) ??
      normalizeBrand(meta?.brand ?? null);
    if (promoMeta.appliesTo === "PREMIUM_ONLY" && premium !== true) return false;
    if (promoMeta.appliesTo === "NON_PREMIUM_ONLY" && premium !== false) return false;
    if (brand && promoMeta.excludedBrands.includes(brand)) return false;
    return true;
  };
  const getBaseUnitPrice = (item: any) => {
    const unit =
      item?.finalPrice ??
      item?.priceAfterDiscount ??
      item?.discountPrice ??
      item?.salePrice ??
      (
        item?.origPrice && item?.discountPercent
          ? Math.round((item.origPrice * (100 - item.discountPercent * 100)) / 100)
          : item?.price
      );
    return Number(unit ?? 0) || 0;
  };
  const total = activeCartItems.reduce((sum, item) => {
    const qty = Number(item.quantity ?? 1);
    const unitPrice = getBaseUnitPrice(item);
    return sum + unitPrice * qty;
  }, 0);
  const eligibleItems = applied && promoMeta ? activeCartItems.filter(isPromoEligible) : activeCartItems;
  const eligibleSubtotal = eligibleItems.reduce((sum, item) => {
    const qty = Number(item.quantity ?? 1);
    const unitPrice = getBaseUnitPrice(item);
    return sum + unitPrice * qty;
  }, 0);
  const totalDiscountRaw = hasDiscount
    ? discount.type === "AMOUNT"
      ? discount.value
      : eligibleSubtotal * discount.value
    : 0;
  const totalDiscount = Math.max(0, Math.min(eligibleSubtotal, totalDiscountRaw));
  const getDiscountedUnitPrice = (item: any) => {
    const qty = Number(item.quantity ?? 1);
    const baseUnit = getBaseUnitPrice(item);
    if (!hasDiscount || eligibleSubtotal <= 0) return baseUnit;
    if (applied && promoMeta && !isPromoEligible(item)) return baseUnit;
    const itemSubtotal = baseUnit * qty;
    const share = eligibleSubtotal > 0 ? (itemSubtotal / eligibleSubtotal) * totalDiscount : 0;
    const newSubtotal = Math.max(0, itemSubtotal - share);
    return Math.max(0, Math.round(newSubtotal / Math.max(1, qty)));
  };
  const discountedTotal = Math.max(0, total - totalDiscount);
  const formatPrice = (value: number | null | undefined) =>
    Number(value ?? 0).toLocaleString('ru-RU');
  const promoLabel =
    discount.type === "AMOUNT"
      ? `${formatPrice(discount.value)}₽`
      : `${Math.round(discount.value * 100)}%`;

  const ownedPromoLabel = (p: { type: "PERCENT" | "AMOUNT"; value: number }) =>
    p.type === "AMOUNT" ? `${formatPrice(p.value)}₽` : `${Math.round(p.value)}%`;

  const applyPromoCode = async (rawCode: string) => {
    const code = String(rawCode || "").trim().toUpperCase();
    if (!code) {
      setPromoError(true);
      setPromoErrorText("Введите промокод");
      setInputBounceTrigger((v) => v + 1);
      return;
    }
    if (activeCartItems.length === 0) {
      setPromoError(true);
      setPromoErrorText("Нет товаров для применения промокода");
      return;
    }
    setPromoError(false);
    setPromoErrorText(null);
    setApplyingPromo(code);
    try {
      // Ensure we have product meta for eligibility checks
      const ids = Array.from(
        new Set(
          activeCartItems
            .map((it: any) => Number(it?.productId ?? it?.id))
            .filter((n: number) => Number.isFinite(n) && n > 0)
        )
      );
      let fetchedMeta: Record<number, { premium: boolean; brand: string | null }> = {};
      if (ids.length) {
        fetchedMeta = await ensureProductMeta(ids);
      }

      const res = await fetch("/api/promocodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, subtotal: total }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.ok || !data?.code) {
        setPromoError(true);
        setPromoErrorText(data?.error || data?.message || "Промокод не подходит");
        setInputBounceTrigger((v) => v + 1);
        return;
      }
      const type =
        data.code.type === "amount" || data.code.type === "AMOUNT"
          ? "AMOUNT"
          : "PERCENT";
      const rawValue = Number(data.code.value ?? 0) || 0;
      const value = type === "PERCENT" ? rawValue / 100 : rawValue;
      const nextMeta = {
        appliesTo:
          data.code.appliesTo === "PREMIUM_ONLY" || data.code.appliesTo === "NON_PREMIUM_ONLY"
            ? data.code.appliesTo
            : "ALL",
        excludedBrands: Array.isArray(data.code.excludedBrands)
          ? data.code.excludedBrands.map((b: any) => String(b).trim().toLowerCase()).filter(Boolean)
          : [],
      };

      const metaMap = { ...productMetaById, ...fetchedMeta };
      const isEligible = (item: any) => {
        const meta = metaMap[Number(item?.productId ?? item?.id)];
        const premium =
          typeof item?.premium === "boolean"
            ? item.premium
            : typeof meta?.premium === "boolean"
            ? meta.premium
            : null;
        const brand =
          normalizeBrand(item?.brand ?? item?.brandName ?? null) ??
          normalizeBrand(meta?.brand ?? null);
        if (nextMeta.appliesTo === "PREMIUM_ONLY" && premium !== true) return false;
        if (nextMeta.appliesTo === "NON_PREMIUM_ONLY" && premium !== false) return false;
        if (brand && nextMeta.excludedBrands.includes(brand)) return false;
        return true;
      };

      const eligibleSubtotal = activeCartItems.reduce((sum, it: any) => {
        if (!isEligible(it)) return sum;
        const qty = Number(it.quantity ?? 1);
        return sum + getBaseUnitPrice(it) * qty;
      }, 0);

      if (!eligibleSubtotal || eligibleSubtotal <= 0) {
        setPromoError(true);
        setPromoErrorText("Промокод не подходит для товаров в корзине");
        setInputBounceTrigger((v) => v + 1);
        return;
      }

      if (data?.minSubtotal && eligibleSubtotal < Number(data.minSubtotal)) {
        setPromoError(true);
        setPromoErrorText(`Минимальная сумма для применения: ${data.minSubtotal}₽`);
        setInputBounceTrigger((v) => v + 1);
        return;
      }

      applyDiscount(value, type);
      setPromoCode(code);
      setPromoMeta(nextMeta);
      setApplied(true);
      setPromoInput("");
      setPromoError(false);
      setPromoErrorText(null);
      try {
        localStorage.setItem("promoCode", code);
        localStorage.setItem("promoApplied", "1");
        localStorage.setItem("promoType", type);
        localStorage.setItem("promoValue", String(value));
        localStorage.setItem("promoMeta", JSON.stringify(nextMeta));
      } catch {}
      try {
        setCookie("promoCode", code, 60 * 60 * 24 * 7);
        setCookie("promoType", type, 60 * 60 * 24 * 7);
        setCookie("promoDiscount", String(value), 60 * 60 * 24 * 7);
      } catch {}
    } finally {
      setApplyingPromo(null);
    }
  };

  const openCheckout = () => {
    if (!user || (user as any)?.isGuest) {
      setShowAuthModal(true);
      return;
    }
    try {
      const draft = {
        items: activeCartItems.map((it: any) => ({
          cartItemId: getCartItemId(it),
          productId: (it as any).productId || it.id,
          name: it.name,
          size: (it as any).size ?? null,
          quantity: (it as any).quantity ?? 1,
          // сохраняем уценённую цену (с учётом промо-скидки) для оплаты
          price: getDiscountedUnitPrice(it),
          // исходная цена для отображения
          origPrice: getBaseUnitPrice(it),
          discountPercent: discount.type === "PERCENT" ? Math.round(discount.value * 100) : undefined,
          image:
            (it as any).image ||
            (it as any).imageUrl ||
            ((it as any).images && (it as any).images[0]) ||
            null,
        })),
        totals: {
          subtotal: total,
          discount,
          total: discountedTotal,
        },
        customer: {
          fullName: (user as any)?.fullName ?? (user as any)?.name ?? "",
          email: (user as any)?.email ?? "",
          phone: (user as any)?.phone ?? "",
          address: (user as any)?.address ?? "",
        },
        createdAt: Date.now(),
      };
      localStorage.setItem("checkoutState", JSON.stringify(draft));
      setHasCheckoutData(true);
      console.debug("[cart] checkoutState saved", draft);
    } catch (e) {
      console.error("[cart] failed to save checkoutState", e);
    }
    setShowCheckout(true);
  };

  const startCheckout = async () => {
    if (posting) return;
    if (!user || (user as any)?.isGuest) {
      setShowAuthModal(true);
      return;
    }

    const active = activeCartItems;
    if (!active.length) {
      showToast({ title: "Корзина пуста", details: "Добавьте товары для оформления заказа" });
      return;
    }

    const customer = {
      fullName: (user as any)?.fullName ?? (user as any)?.name ?? "",
      email: (user as any)?.email ?? "",
      phone: (user as any)?.phone ?? "",
      address: (user as any)?.address ?? "",
    };

    const draft = {
      items: active.map((it: any) => ({
        cartItemId: getCartItemId(it),
        productId: it.id,
        name: it.name,
        size: (it as any).size ?? null,
        quantity: (it as any).quantity ?? 1,
        price: getDiscountedUnitPrice(it),
        origPrice: getBaseUnitPrice(it),
        discountPercent: discount.type === "PERCENT" ? Math.round(discount.value * 100) : undefined,
        image:
          (it as any).image ||
          (it as any).imageUrl ||
          ((it as any).images && (it as any).images[0]) ||
          null,
      })),
      totals: { subtotal: total, discount, total: discountedTotal },
      customer,
      createdAt: Date.now(),
    };

    try {
      localStorage.setItem("checkoutState", JSON.stringify(draft));
    } catch {}

    if (!customer.fullName || !customer.email || !customer.phone || !customer.address) {
      setShowCheckout(true);
      return;
    }

    try {
      setPosting(true);
      const cartTokenRaw =
        readCookie("cart_token") || readCookie("cartToken") || null;
      const cartItemIds = active
        .map((it: any) => getCartItemId(it))
        .filter((id: number | null) => Number.isFinite(id));
      const useCartToken = cartItemIds.length === active.length;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          cartToken: cartTokenRaw || null,
          items: active.map((it: any) => ({
            cartItemId: (it as any).id ?? null,
            productId: it.id,
            name: it.name,
            price: getDiscountedUnitPrice(it),
            origPrice: getBaseUnitPrice(it),
            discountPercent: discount.type === "PERCENT" ? Math.round(discount.value * 100) : undefined,
            quantity: Number((it as any).quantity ?? 1),
            size: (it as any).size ?? null,
            image:
              (it as any).image ||
              (it as any).imageUrl ||
              ((it as any).images && (it as any).images[0]) ||
              null,
          })),
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          comment: "",
          promo: promoCode ? { code: promoCode } : undefined,
        }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.orderId) {
        console.error("[cart] checkout failed", { status: res.status, data });
        showToast({ title: "Ошибка оформления", details: data?.message || "Попробуйте чуть позже" });
        return;
      }

      // Persist order id/token in multiple client-visible cookies for compatibility with mock-bank
      try {
        const orderIdStr = String(data.orderId);
        const expiry = 60 * 30; // 30 minutes

        // main ids
        setCookie('order_id', orderIdStr, expiry);
        setCookie('pending_order_id', orderIdStr, expiry);
        setCookie('orderId', orderIdStr, expiry);
        // some UIs read "oid" or "last_order_id"
        setCookie('oid', orderIdStr, expiry);
        setCookie('last_order_id', orderIdStr, expiry);

        // token alias (non-HttpOnly), API may also set a secure HttpOnly one
        if (data?.token) {
          setCookie('order_token', String(data.token), 60 * 60 * 24 * 30);
        }
      } catch {}

      // also keep in web storage for same-tab access
      try {
        sessionStorage.setItem('last_order_id', String(data.orderId));
        localStorage.setItem('last_order_id', String(data.orderId));
      } catch {}

      // give the browser a microtask to flush cookies before navigation
      await new Promise((r) => setTimeout(r, 0));

      router.push(`/mock-bank?orderId=${data.orderId}`);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-8 py-8 sm:py-12 pb-32 sm:pb-12">
      <h1 className="text-3xl font-bold mb-6">Корзина</h1>

      {cartItems.length === 0 ? (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center text-center text-gray-500 mb-6"
          >
            <ShoppingBag className="w-12 h-12 mb-2 text-gray-400" />
            <p className="text-lg font-medium">Корзина пуста</p>
          </motion.div>

          {recentProducts.length > 0 && (
            <>
              <h2 className="text-xl font-semibold mb-6 text-gray-800">Недавно просмотренные</h2>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6"
              >
                {loadingRecent ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse border rounded-xl bg-gray-100 h-64" />
                  ))
                ) : (
                  recentProducts.map((item, index) => (
                    <Link key={`${item.id}-${index}`} href={`/product/${item.id}`}>
                      <div className="group border rounded-xl overflow-hidden shadow hover:shadow-lg transition-all bg-white hover:ring-2 hover:ring-gray-300">
                        <div className="relative w-full h-48 bg-gray-100">
                          <Image
                            src={item.images?.[0] || item.imageUrl || "/img/placeholder.png"}
                            alt={item.name}
                            fill
                            className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-3">
                          <h3 title={item.name} className="text-sm font-semibold text-gray-800 group-hover:text-black truncate">
                            {isPremiumProduct(item) && <span className="text-black mr-1" aria-label="premium">★</span>}
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {(() => {
                              const sizes = (item as any)?.sizes;
                              if (sizes?.prices) {
                                const minPrice = Math.min(...Object.values(sizes.prices) as number[]);
                                return `от ${minPrice.toLocaleString('ru-RU')}₽`;
                              }
                              return `${Number(item.price ?? 0).toLocaleString('ru-RU')}₽`;
                            })()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </motion.div>
            </>
          )}

          <p className="mt-10 text-center text-base text-gray-500 font-medium">
            или
          </p>
          <p className="text-center mt-2">
            <Link
              href="/"
              className="text-gray-500 text-base font-semibold transition-transform hover:text-black hover:underline underline-offset-2 hover:scale-105"
            >
              Перейти в каталог
            </Link>
          </p>
        </>
      ) : (
        <>
          <div className="space-y-4 sm:space-y-6">
            {cartItems.map((item, index) => {
              const qty = Number((item as any).quantity ?? 1);
              const basePrice = Number(item.price ?? 0);
              const unitFinalPrice = applied ? getDiscountedUnitPrice(item) : basePrice;
              const lineFinalPrice = unitFinalPrice * qty;
              const lineBasePrice = basePrice * qty;
              const isPostponed = postponedItems.includes(getPostponedKey(item));
              const sizeValue = (item as any).size ?? (item as any).sizeLabel ?? (item as any).ProductItem?.sizeLabel ?? "—";
              const sizeLabel =
                item.name.toLowerCase().includes("parfum") || item.name.toLowerCase().includes("духи")
                  ? `Объём: ${sizeValue} мл`
                  : `Размер: ${sizeValue}`;
              const productId = (item as any).productId || (item as any).id;

              return (
                <Link key={index} href={`/product/${productId}`} className="block">
                  <div
                    className={`flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-5 rounded-2xl border ${
                      isPostponed ? 'border-dashed border-gray-300 bg-gray-50' : 'border-gray-200 bg-white/90'
                    } shadow-[0_25px_50px_rgba(15,23,42,0.08)] transition`}
                  >
                    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 sm:w-32 sm:h-32">
                      <Image
                        src={
                          (item as any).image ||
                          (item as any).imageUrl ||
                          ((item as any).images && (item as any).images[0]) ||
                          "/img/placeholder.png"
                        }
                        alt={item.name}
                        fill
                        className="object-contain object-center p-2"
                      />
                      {isPostponed && (
                        <span className="absolute top-3 left-3 px-3 py-1 text-xs font-semibold rounded-full bg-white/90 text-gray-700 shadow-sm">
                          Отложено
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="space-y-1">
                          <h3
                            title={item.name}
                            className={`text-lg font-semibold leading-snug ${isPostponed ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                          >
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-500">{sizeLabel}</p>
                        </div>
                        {isPremiumProduct(item) && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black text-white text-xs font-semibold">
                            <span aria-hidden>★</span>
                            Premium
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        {qty > 1 && (
                          <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-gray-100 font-medium">
                            <span>Количество: {qty}</span>
                            <span className="text-gray-400 text-xs">
                              + {formatPrice(basePrice * (qty - 1))}₽
                            </span>
                          </span>
                        )}
                        {item.badge && <span className="px-2 py-1 rounded-full bg-gray-100 font-medium">{item.badge}</span>}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xl font-semibold text-gray-900">
                            {formatPrice(lineFinalPrice)}₽
                          </p>
                          {applied ? (
                            <div className="text-sm text-gray-500 space-y-0.5">
                              <p className="line-through">{formatPrice(lineBasePrice)}₽</p>
                              {qty > 1 && (
                                <p className="text-xs text-gray-400">
                                  {qty} × {formatPrice(unitFinalPrice)}₽
                                </p>
                              )}
                            </div>
                          ) : (
                            qty > 1 && (
                              <p className="text-xs text-gray-500">
                                {qty} × {formatPrice(unitFinalPrice)}₽
                              </p>
                            )
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              togglePostponed(item);
                              const wasPostponed = postponedItems.includes(getPostponedKey(item));
                              setTimeout(() => {
                                showToast({
                                  title: wasPostponed ? 'Возвращён в корзину' : 'Товар отложен',
                                  details: item.name,
                                });
                              }, 0);
                            }}
                            className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                              isPostponed
                                ? 'border-yellow-400 text-yellow-600 bg-yellow-50'
                                : 'border-gray-200 text-gray-600 hover:border-gray-400'
                            }`}
                          >
                            <span aria-hidden>📌</span>
                            {isPostponed ? 'Вернуть' : 'Отложить'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleRemove(index);
                            }}
                            className="p-2 rounded-lg border border-transparent text-gray-400 hover:text-red-600 hover:border-red-100 transition"
                            aria-label="Удалить"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Промокод */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Промокоды</h3>
              <Link
                href="/profile/promocodes"
                className="text-xs sm:text-sm text-gray-500 hover:text-black transition"
              >
                Все промокоды
              </Link>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-3">
                Активированные
              </p>
              {loadingPromos ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-7 w-24 rounded-full bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : ownedPromos.length ? (
                <div className="flex flex-wrap gap-2">
                  {ownedPromos.map((p) => {
                    const isActive = applied && promoCode === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => applyPromoCode(p.code)}
                        className={`px-3 py-1.5 rounded-full border text-xs sm:text-sm font-semibold transition ${
                          isActive
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                        }`}
                        title="Применить промокод"
                      >
                        {p.code} · {ownedPromoLabel(p)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  У вас пока нет активированных промокодов.
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value);
                    if (promoError) setPromoError(false);
                  }}
                  placeholder="Введите промокод"
                  className={`w-full rounded-xl border px-4 py-3 text-sm sm:text-base bg-white transition ${
                    promoError ? "border-red-400 bg-red-50" : "border-gray-200"
                  }`}
                />
                {promoErrorText && (
                  <p className="mt-2 text-xs sm:text-sm text-red-500">{promoErrorText}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => applyPromoCode(promoInput)}
                disabled={applyingPromo !== null}
                className="rounded-xl bg-black text-white px-4 py-3 text-sm font-semibold shadow-lg shadow-black/20 transition disabled:opacity-60"
              >
                {applyingPromo ? "Проверяем..." : "Применить"}
              </button>
            </div>

            {applied && (
              <div className="text-sm sm:text-base rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-green-800">
                ✅ Активен промокод <strong>{promoCode}</strong> — скидка {promoLabel}
              </div>
            )}
          </div>

          {/* Итог + кнопки */}
          <div
            ref={summaryRef}
            className="mt-8 rounded-2xl border border-gray-200 bg-white/90 px-4 py-5 sm:px-6 sm:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-[0_25px_45px_rgba(15,23,42,0.08)]"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-1">Итого</p>
              <p className="text-3xl font-semibold text-gray-900">
                {formatPrice(discountedTotal)}₽
              </p>
              {hasDiscount && (
                <p className="text-sm text-gray-400 line-through">
                  {formatPrice(total)}₽
                </p>
              )}
              {applied && (
                <p className="text-sm text-gray-500 mt-2">
                  Скидка {promoLabel} · {eligibleItems.length} из {cartItems.length} товаров участвуют
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={startCheckout}
                disabled={posting}
                className="inline-flex items-center justify-center rounded-xl bg-black text-white px-4 py-2.5 text-sm font-semibold shadow-lg shadow-black/20 transition disabled:opacity-60 disabled:pointer-events-none"
              >
                {hasCheckoutData ? "Продолжить оформление" : "Перейти к оформлению"}
              </button>
            </div>
          </div>
        </>
      )}
      <CheckoutModal visible={showCheckout} onClose={() => setShowCheckout(false)} />
      {showAuthModal && (
        <AuthGateModal
          onClose={() => setShowAuthModal(false)}
          onLogin={() => (window.location.href = "/login")}
          onRegister={() => (window.location.href = "/register")}
        />
      )}
      <AnimatePresence>
        {cartItems.length > 0 && !isBottomSummaryVisible && (
          <motion.div
            key="mobile-summary"
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-4"
          >
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-[0_-15px_30px_rgba(15,23,42,0.18)]">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-1">Итого</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatPrice(discountedTotal)}₽
                </p>
                {hasDiscount && (
                  <p className="text-xs text-gray-400 line-through">
                    {formatPrice(total)}₽
                  </p>
                )}
              </div>
              <button
                onClick={startCheckout}
                disabled={posting}
                className="flex-1 inline-flex items-center justify-center rounded-xl bg-black text-white px-4 py-3 text-base font-semibold shadow-lg shadow-black/20 transition disabled:opacity-60 disabled:pointer-events-none"
              >
                Оформить
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
