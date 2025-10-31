'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useDiscount } from "@/context/DiscountContext";

const normalizeCartItem = (it: any): CartItem => ({
  id: Number(it?.id),
  productId: Number(it?.productId ?? it?.ProductItem?.productId ?? it?.product?.id ?? it?.Product?.id ?? it?.id ?? 0),
  name: String(it?.name ?? ""),
  price: Number(it?.price ?? 0),
  image: String(it?.image ?? ""),
  size: it?.size ?? it?.sizeLabel ?? it?.ProductItem?.sizeLabel ?? it?.productItem?.sizeLabel,
  postponed: Boolean(it?.postponed) || false,
  quantity: Number(it?.quantity ?? 1),
  productItemId: it?.productItemId ?? it?.ProductItem?.id ?? null,
});

interface CartItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  image: string;
  productItemId?: number | null;
  size?: string | number;
  postponed?: boolean;
  quantity?: number;

  finalPrice?: number;
  priceAfterDiscount?: number;
  discountPrice?: number;
  salePrice?: number;
  origPrice?: number;
  originalPrice?: number;
  basePrice?: number;
  oldPrice?: number;
  discountPercent?: number;
  discount?: number;
  images?: string[];
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (id: number) => Promise<void>;
  discount: number;
  applyDiscount: (percent: number) => void;
  resetDiscount: () => void;
  togglePostponed: (id: number) => void;
  getActiveTotalAmount: () => number;
  getActiveItems: () => CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  getActiveCount: () => number;
  postponedItems: number[];
  setPostponedItems: React.Dispatch<React.SetStateAction<number[]>>;
  updateQuantity: (id: number, size?: string | number, qty?: number) => Promise<void>;
  clearCart: () => Promise<void>;
  discountedTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "cart";
const CART_COOKIE = "cart_cache";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

const persistCart = (items: CartItem[]) => {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(items);
  try { localStorage.setItem(CART_KEY, payload); } catch {}
  try {
    document.cookie = `${CART_COOKIE}=${encodeURIComponent(payload)}; Path=/; Max-Age=${CART_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {}
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [postponedItems, setPostponedItems] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);

  const discountCtx = useDiscount();
  const externalDiscount = discountCtx?.discount ?? 0;
  const externalApply = discountCtx?.applyDiscount;
  const externalReset = discountCtx?.resetDiscount;

  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const res = await fetch("/api/cart", { cache: "no-store", credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data?.items)) {
          setCartItems(data.items.map(normalizeCartItem));
          setLoaded(true);
          return;
        }
      } catch {}
      // fallback to local storage if API unavailable
      let raw = null;
      try { raw = localStorage.getItem(CART_KEY); } catch {}
      if (!raw) raw = readCookie(CART_COOKIE);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setCartItems(parsed.map(normalizeCartItem));
          }
        } catch {}
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("postponedItems", JSON.stringify(postponedItems));
  }, [postponedItems]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("postponedItems");
      if (stored) {
        setPostponedItems(JSON.parse(stored));
      }
    }
  }, []);

  useEffect(() => {
    persistCart(cartItems);
  }, [cartItems]);


  const addToCart = async (item: CartItem) => {
    const payload = {
      productId: (item as any)?.productId ?? item.id,
      productItemId: (item as any)?.productItemId ?? null,
      name: item.name,
      price: item.price,
      image: item.image,
      size: item.size ?? null,
      quantity: item.quantity ?? 1,
    };
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.items) {
        setCartItems(data.items.map(normalizeCartItem));
      } else {
        // fallback to local update if API failed
        const normalized = normalizeCartItem({
          ...item,
          postponed: false,
          quantity: item.quantity ?? 1,
        });
        setCartItems((prev) => [...prev, normalized]);
      }
    } catch {
      const normalized = normalizeCartItem({
        ...item,
        postponed: false,
        quantity: item.quantity ?? 1,
      });
      setCartItems((prev) => [...prev, normalized]);
    }
  };

  const removeFromCart = async (id: number) => {
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.items) {
        setCartItems(data.items.map(normalizeCartItem));
        return;
      }
    } catch {}
    setCartItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateQuantity = async (id: number, _size?: string | number, qty?: number) => {
    const nextQty = Math.max(1, Number(qty ?? 1));
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, quantity: nextQty }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.items) {
        setCartItems(data.items.map(normalizeCartItem));
        return;
      }
    } catch {}
    setCartItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantity: nextQty } : it))
    );
  };

  const applyDiscount = (percent: number) => {
    // delegate to global discount context if present
    try {
      externalApply?.(percent);
    } catch (e) {
      // ignore if external apply not available
    }
    // keep localStorage in sync for other parts of the app
    if (typeof window !== 'undefined') localStorage.setItem('discount', percent.toString());
  };

  const resetDiscount = () => {
    try {
      externalReset?.();
    } catch (e) {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('discount');
      localStorage.removeItem('promoCode');
    }
  };

  const clearCart = async () => {
    setCartItems([]);
    setPostponedItems([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem("postponedItems");
      try {
        document.cookie = `${CART_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
      } catch {}
    }
    try {
      await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: -1 }), // noop delete to trigger cleanup
      });
    } catch {}
  };

  const togglePostponed = (id: number) => {
    setPostponedItems((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const getActiveItems = () => {
    return cartItems.filter((item) => !postponedItems.includes(item.id));
  };

  const getUnitPrice = (it: any) => {
    const n = (v: any) => {
      const numVal = Number(v);
      return Number.isFinite(numVal) ? numVal : NaN;
    };

    const final = n(it?.finalPrice ?? it?.priceAfterDiscount ?? it?.discountPrice ?? it?.salePrice ?? it?.price);
    if (Number.isFinite(final)) return final;

    const orig = n(it?.origPrice ?? it?.originalPrice ?? it?.basePrice ?? it?.oldPrice);
    const perc = n(it?.discountPercent ?? it?.discount);
    if (Number.isFinite(orig) && Number.isFinite(perc) && perc > 0) {
      return Math.round((orig * (100 - perc)) / 100);
    }

    const raw = n(it?.price);
    if (Number.isFinite(raw)) return raw;
    if (Number.isFinite(orig)) return orig;
    return 0;
  };

  const getActiveTotalAmount = () => {
    const subtotal = cartItems
      .filter((item) => !postponedItems.includes(item.id))
      .reduce((sum, item) => {
        const unit = getUnitPrice(item);
        const qty = Number(item.quantity ?? 1);
        return sum + unit * qty;
      }, 0);

    const discountValue = externalDiscount ?? 0;
    const discounted = discountValue > 0 ? subtotal * (1 - discountValue / 100) : subtotal;
    return Math.max(0, +discounted.toFixed(2));
  };

  const getActiveCount = () => {
    return cartItems
      .filter((item) => !postponedItems.includes(item.id))
      .reduce((n, item) => n + (item.quantity ?? 1), 0);
  };

  const discountedTotal = getActiveTotalAmount();

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        discount: externalDiscount,
        applyDiscount,
        resetDiscount,
        togglePostponed,
        getActiveTotalAmount,
        setCartItems,
        getActiveItems,
        getActiveCount,
        postponedItems,
        setPostponedItems,
        updateQuantity,
        clearCart,
        discountedTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context)
    throw new Error("useCart must be used within CartProvider");
  return context;
};

export { useCart };
