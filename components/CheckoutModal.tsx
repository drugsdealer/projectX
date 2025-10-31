"use client";

import { useRouter } from "next/navigation";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { YMaps, Map as YMap, Placemark } from "@pbe/react-yandex-maps";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  User,
  ClipboardCheck,
  CreditCard,
  Smile,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useUser } from "@/user/UserContext";
import { useDiscount } from "@/context/DiscountContext";

const steps = ["ФИО", "Подтверждение", "Оплата", "Ответ"];

type CheckoutItem = {
  productItemId?: number | null;
  productId?: number | null;
  quantity: number;
  price?: number;
};

type DeliveryInfoModalProps = {
  open: boolean;
  variant: "moscow" | "russia";
  onClose: () => void;
};

const DeliveryInfoModal: React.FC<DeliveryInfoModalProps> = ({
  open,
  variant,
  onClose,
}) => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="delivery-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-4 text-sm text-gray-800"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-4 text-2xl text-gray-500 hover:text-black"
              aria-label="Закрыть условия доставки"
            >
              ×
            </button>

            {variant === "moscow" ? (
              <>
                <h3 className="text-xl font-bold mb-3 text-center">
                  Доставка по Москве и области
                </h3>
                <ul className="text-sm space-y-2 list-disc pl-5 text-gray-700">
                  <li>
                    <strong>Самовывоз</strong> доступен по адресу: Москва, ул.
                    Примерная, д. 10. Уточните доступность по телефону.
                  </li>
                  <li>
                    <strong>Курьерская доставка</strong> по Москве —
                    <span className="font-semibold"> 499 ₽</span>.
                  </li>
                </ul>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-center">
                  Условия доставки по Москве и РФ
                </h3>
                <div>
                  <h4 className="text-lg font-semibold mb-1">📦 Доставка по Москве:</h4>
                  <p>
                    Мы предлагаем два удобных варианта получения вашего заказа в пределах Москвы:
                  </p>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>
                      <strong>Самовывоз</strong> — доступен по адресу: Москва, ул. Примерная, д. 10. График работы с 10:00 до 21:00.
                    </li>
                    <li>
                      <strong>Курьерская доставка</strong> — осуществляется по городу Москве. Стоимость услуги — <strong>499 ₽</strong>.
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-1">🚚 Доставка по России:</h4>
                  <p>
                    Доставляем по всей России надёжными транспортными компаниями.
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default function CheckoutModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(visible);
  const [error, setError] = useState(false);
  const [paying, setPaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const cartCtx: any = useCart();
  const { discount } = useDiscount();
  const cartItems = cartCtx?.cartItems ?? [];
  const { user, login } = useUser();

  // --- ОТКРЫТИЕ/ЗАКРЫТИЕ МОДАЛКИ ---

  const handleUserClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    // Извне разрешаем ТОЛЬКО открывать модалку
    if (visible) setOpen(true);
  }, [visible]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ЦЕН ---

  const num = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  const getUnitPrice = (it: any) => {
    const nLocal = (v: any) => {
      const nVal = Number(v);
      return Number.isFinite(nVal) ? nVal : NaN;
    };

    // финальная цена
    const final = nLocal(
      it?.finalPrice ??
        it?.priceAfterDiscount ??
        it?.discountPrice ??
        it?.salePrice
    );
    if (Number.isFinite(final)) return final;

    // из оригинальной + % скидки
    const orig = nLocal(
      it?.origPrice ?? it?.originalPrice ?? it?.basePrice ?? it?.oldPrice
    );
    const perc = nLocal(it?.discountPercent ?? it?.discount);
    if (Number.isFinite(orig) && Number.isFinite(perc) && perc > 0) {
      return Math.round((orig * (100 - perc)) / 100);
    }

    // обычная цена
    const rawPrice = nLocal(it?.price);
    if (Number.isFinite(rawPrice)) return rawPrice;

    if (Number.isFinite(orig)) return orig;

    return 0;
  };

  const isSaved = (it: any) =>
    Boolean(
      it?.saved === true ||
        it?.isSaved === true ||
        it?.deferred === true ||
        it?.status === "saved"
    );

  const activeCartItems = useMemo(
    () => (cartItems as any[]).filter((i) => !isSaved(i)),
    [cartItems]
  );

  const activeCount = useMemo(
    () => activeCartItems.length,
    [activeCartItems]
  );

  const activeTotal = useMemo(
    () =>
      activeCartItems.reduce((sum: number, it: any) => {
        const q = num(it?.quantity) || 1;
        const unit = getUnitPrice(it);
        return sum + unit * q;
      }, 0),
    [activeCartItems]
  );

  const discountedTotal = useMemo(() => {
    const subtotal = activeTotal;
    const discounted = discount > 0 ? subtotal * (1 - discount) : subtotal;
    return Math.max(0, +discounted.toFixed(2));
  }, [activeTotal, discount]);

  /**
   * Строим позиции из корзины (без сетевых запросов).
   */
  const buildCheckoutItemsSync = (): (CheckoutItem & { _raw?: any })[] => {
    const result: (CheckoutItem & { _raw?: any })[] = [];
    for (const it of activeCartItems as any[]) {
      const rawId =
        (it as any)?.productItemId ??
        (it as any)?.variantId ??
        (it as any)?.itemId ??
        (it as any)?.skuId ??
        null;

      const rawProductId =
        (it as any)?.productId ??
        (it as any)?.product?.id ??
        (it as any)?.id ??
        (it as any)?.product?.productId ??
        null;

      const qty = Number((it as any)?.quantity ?? 1);
      const price = Number((it as any)?.price);

      const productItemIdNum = rawId != null ? Number(rawId) : NaN;
      const productIdNum = rawProductId != null ? Number(rawProductId) : NaN;

      result.push({
        productItemId: Number.isFinite(productItemIdNum)
          ? productItemIdNum
          : null,
        productId: Number.isFinite(productIdNum) ? productIdNum : null,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        price: Number.isFinite(price) ? price : undefined,
        _raw: it,
      });
    }
    return result;
  };

  /**
   * Если у позиций нет productItemId, пытаемся вычислить его по productId + size через /api/products/[id].
   */
  const resolveMissingProductItemIds = async (
    items: (CheckoutItem & { _raw?: any })[]
  ) => {
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };

    const norm = (s: string) => s.trim().toLowerCase();

    const toResolve = items.filter(
      (i) =>
        !(
          typeof i.productItemId === "number" &&
          Number.isFinite(i.productItemId)
        )
    );
    if (!toResolve.length) return items;

    const groups = new Map<
      number,
      { idx: number; item: CheckoutItem & { _raw?: any } }[]
    >();

    for (let idx = 0; idx < items.length; idx++) {
      const i = items[idx];
      if (
        typeof i.productItemId === "number" &&
        Number.isFinite(i.productItemId)
      )
        continue;

      const raw = i._raw || {};
      const productId = toNum(
        (raw as any)?.productId ??
          (raw as any)?.product?.id ??
          (raw as any)?.id ??
          (raw as any)?.product?.productId ??
          i.productId ??
          NaN
      );

      if (!Number.isFinite(productId)) continue;

      i.productId = productId;

      const arr = groups.get(productId) || [];
      arr.push({ idx, item: i });
      groups.set(productId, arr);
    }

    for (const [productId, list] of Array.from(groups.entries())) {
      try {
        const res = await fetch(`/api/products/${productId}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`GET /api/products/${productId} -> ${res.status}`);
        const data = await res.json().catch(() => ({} as any));

        let variants: any[] = [];
        const pushAll = (arr: any) => {
          if (Array.isArray(arr)) variants.push(...arr);
        };
        pushAll(data?.product?.items);
        pushAll(data?.product?.productItems);
        pushAll(data?.items);
        pushAll(data?.productItems);
        pushAll(data?.product?.variants);

        variants = variants.filter(Boolean);

        if (!variants.length) {
          console.warn("[checkout] product has no variants", { productId, data });
          continue;
        }

        for (const { idx, item } of list) {
          const raw = item._raw || {};
          const sizeLabelRaw =
            (raw as any)?.sizeLabel ??
            (raw as any)?.size ??
            (raw as any)?.selectedSize ??
            (raw as any)?.variant?.size ??
            null;

          const want = sizeLabelRaw ? norm(String(sizeLabelRaw)) : "";
          const wantDigits = want.replace(/\D/g, "");

          const getLabel = (v: any): string => {
            const cand =
              v?.sizeLabel ??
              v?.label ??
              v?.name ??
              v?.size?.label ??
              v?.sizeCl?.label ??
              "";
            return norm(String(cand));
          };

          let match: any = null;
          if (want) {
            match = variants.find((v) => {
              const lbl = getLabel(v);
              if (!lbl) return false;
              if (lbl === want) return true;
              if (lbl.replace(/\s+/g, "") === want.replace(/\s+/g, ""))
                return true;
              const lblDigits = lbl.replace(/\D/g, "");
              if (wantDigits && lblDigits && lblDigits === wantDigits)
                return true;
              return false;
            });
          }

          if (!match && variants.length > 0) {
            match = variants[0];
          }

          let resolvedId = toNum(
            match?.id ??
              match?.productItemId ??
              match?.itemId ??
              match?.variantId ??
              match?.product_item_id ??
              match?.productitemid
          );

          if (!Number.isFinite(resolvedId) && match && typeof match === "object") {
            for (const k of Object.keys(match)) {
              if (/id$/i.test(k)) {
                const n = toNum((match as any)[k]);
                if (Number.isFinite(n)) {
                  resolvedId = n;
                  break;
                }
              }
            }
          }

          if (Number.isFinite(resolvedId)) {
            items[idx].productItemId = resolvedId;
          } else {
            console.warn("[checkout] could not resolve variant id", {
              productId,
              match,
              raw,
            });
          }
        }
      } catch (e) {
        console.warn(
          "[checkout] resolveMissingProductItemIds failed for product",
          productId,
          e
        );
      }
    }
    return items;
  };

  // --- СТЕЙТЫ ОФОРМЛЕНИЯ ---

  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [detectedCity, setDetectedCity] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [city, setCity] = useState("");
  const [showMoscowInfo, setShowMoscowInfo] = useState(false);
  const [showRussiaInfo, setShowRussiaInfo] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"success" | "fail" | null>(
    null
  );

  const restoreOrderIdFromQuery = (): string => {
    if (typeof window === "undefined") return "";
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get("orderId") || params.get("order") || "").trim();
    } catch {
      return "";
    }
  };

  const [orderId, setOrderId] = useState<string>("");
  const [fio, setFio] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);

  const saveCheckoutStatePartial = useCallback(
    (
      partial: Partial<{
        step: number;
        fio: string;
        email: string;
        phone: string;
        agree: boolean;
        address: string;
      }>
    ) => {
      try {
        if (typeof window === "undefined") return;
        const raw = localStorage.getItem("checkoutState");
        const prev = raw ? JSON.parse(raw) : {};
        const base = { step, fio, email, phone, agree, address };
        const next = { ...prev, ...base, ...partial };
        localStorage.setItem("checkoutState", JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [step, fio, email, phone, agree, address]
  );

  // первичное восстановление черновика
  useEffect(() => {
    try {
      const saved = localStorage.getItem("checkoutState");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.step === "number") setStep(parsed.step);
        if (typeof parsed.fio === "string") setFio(parsed.fio);
        if (typeof parsed.email === "string") setEmail(parsed.email);
        if (typeof parsed.phone === "string") setPhone(parsed.phone);
        if (typeof parsed.agree === "boolean") setAgree(parsed.agree);
        if (typeof parsed.address === "string") setAddress(parsed.address);
      }
    } catch {
      // ignore
    }
  }, []);

  const formatPhone = useCallback((raw: string) => {
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("8")) digits = "7" + digits.slice(1);
    if (!digits.startsWith("7")) digits = "7" + digits;
    digits = digits.slice(0, 11);
    let formatted = "+7";
    if (digits.length > 1) formatted += " " + digits.slice(1, 4);
    if (digits.length >= 4) formatted += " " + digits.slice(4, 7);
    if (digits.length >= 7) formatted += "-" + digits.slice(7, 9);
    if (digits.length >= 9) formatted += "-" + digits.slice(9, 11);
    return formatted;
  }, []);

    useEffect(() => {
      // Один раз подставляем данные из профиля пользователя,
      // но не перетираем то, что пользователь уже начал вводить.
      if (user && !user.isGuest) {
        const nextFio = user.name ?? "";
        const nextEmail = user.email ?? "";
        const nextPhone = user.phone ? formatPhone(user.phone) : "";
        const nextAddress = user.address ?? "";

        // Если поля ещё пустые — заполняем из профиля
        setFio((prev) => (prev ? prev : nextFio));
        setEmail((prev) => (prev ? prev : nextEmail));
        setPhone((prev) => (prev ? prev : nextPhone));
        setAddress((prev) => (prev ? prev : nextAddress));

        if (user.city) setCity(user.city);
      }
    }, [user, formatPhone]);

  // Сохраняем чек-аут состояние при изменении ключевых полей
  useEffect(() => {
    saveCheckoutStatePartial({});
  }, [step, fio, email, phone, agree, address, saveCheckoutStatePartial]);

  // --- ФИО ПЛЕЙСХОЛДЕР (АНИМАЦИЯ) ---

  const [fioError, setFioError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const [agreeError, setAgreeError] = useState(false);

  const emailDomains = useMemo(
    () => ["gmail.com", "yahoo.com", "outlook.com", "mail.ru", "icloud.com", "yandex.ru"],
    []
  );

  const fioExamples = [
    "Иванов Иван Иванович",
    "Сергеев Сергей Сергеевич",
    "Петров Пётр Петрович",
  ];
  const [fioPlaceholder, setFioPlaceholder] = useState("");
  const fioIndex = useRef(0);
  const charIndex = useRef(0);
  const direction = useRef<"forward" | "backward">("forward");

  useEffect(() => {
    const interval = setInterval(() => {
      const current = fioExamples[fioIndex.current];
      if (direction.current === "forward") {
        setFioPlaceholder(current.slice(0, charIndex.current + 1));
        charIndex.current++;
        if (charIndex.current > current.length) {
          direction.current = "backward";
        }
      } else {
        setFioPlaceholder(current.slice(0, charIndex.current - 1));
        charIndex.current--;
        if (charIndex.current <= 0) {
          direction.current = "forward";
          fioIndex.current = (fioIndex.current + 1) % fioExamples.length;
        }
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // --- РАЗБОР РЕЗУЛЬТАТА ОПЛАТЫ И ЧТЕНИЕ ORDERID ---

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const queryStatus = params.get("status");
    let currentOrderId = restoreOrderIdFromQuery();

    if (!currentOrderId) {
      try {
        const stored = (localStorage.getItem("orderId") || "").trim();
        if (stored) currentOrderId = stored;
      } catch {
        // ignore
      }
    }

    if (currentOrderId) {
      setOrderId(currentOrderId);
      try {
        localStorage.setItem("orderId", currentOrderId);
        document.cookie = `last_order_id=${encodeURIComponent(
          currentOrderId
        )}; Max-Age=900; Path=/`;
      } catch {
        // ignore
      }
    }

    if (queryStatus === "success") {
      setOpen(true);
      setPaymentStatus("success");
      setStep(3);
      try {
        if (cartCtx?.clearActive) cartCtx.clearActive();
        else if (cartCtx?.removePurchased) cartCtx.removePurchased();
        else if (cartCtx?.setCartItems) {
          const onlySaved = (cartItems as any[]).filter((i: any) => isSaved(i));
          cartCtx.setCartItems(onlySaved);
        }
        localStorage.removeItem("pendingPurchasedScope");
      } catch {
        // ignore
      }
    } else if (queryStatus === "failed") {
      setOpen(true);
      setError(true);
      setPaymentStatus("fail");
      setStep(3);
    }
  }, [cartCtx, cartItems]);

  // --- ГЕОКОДИНГ / КАРТА ---

  const geocodeAddress = useCallback(
    async (addr: string) => {
      if (!addr.trim()) return "";
      setIsGeocoding(true);
      try {
        const response = await fetch(
          `https://geocode-maps.yandex.ru/1.x/?apikey=6ff09043-a633-4dfc-aee3-96794db4de23&format=json&geocode=${encodeURIComponent(
            addr
          )}`
        );
        const data = await response.json();
        const found =
          data?.response?.GeoObjectCollection?.featureMember?.[0];
        if (found) {
          const components =
            found.GeoObject.metaDataProperty?.GeocoderMetaData?.Address
              ?.Components || [];
          const cityComponent = components.find(
            (c: any) => c.kind === "locality" || c.kind === "province"
          );
          if (cityComponent) {
            setDetectedCity(cityComponent.name);
            return cityComponent.name;
          }
        }
      } catch (error) {
        console.error("Ошибка геокодирования:", error);
      } finally {
        setIsGeocoding(false);
      }
      return "";
    },
    []
  );

  const handleMapClick = async (e: any) => {
    const coords = e.get("coords");
    setCoordinates(coords);
    try {
      const response = await fetch(
        `https://geocode-maps.yandex.ru/1.x/?apikey=6ff09043-a633-4dfc-aee3-96794db4de23&format=json&geocode=${coords[1]},${coords[0]}`
      );
      const data = await response.json();
      const found =
        data?.response?.GeoObjectCollection?.featureMember?.[0];
      if (found) {
        const meta = found.GeoObject?.metaDataProperty?.GeocoderMetaData;
        const text = meta?.text || found.GeoObject?.name || "";
        const comps = meta?.Address?.Components || [];
        const line = comps
          .map((c: any) => c?.name)
          .filter(Boolean)
          .join(", ");
        const picked = text || line;
        if (picked) {
          setAddress(picked);
          saveCheckoutStatePartial({ address: picked });
        }
        const cityComp = comps.find(
          (c: any) => c.kind === "locality" || c.kind === "province"
        );
        if (cityComp?.name) setDetectedCity(cityComp.name);
      }
    } catch (error) {
      console.error("Ошибка геокодирования:", error);
    }
  };

  // --- ОФОРМЛЕНИЕ / ПЕРЕХОД МЕЖДУ ШАГАМИ ---

  const goNext = async () => {
    if (step === 0 && address.trim().length < 5) {
      setAddressError(true);
      return;
    } else {
      setAddressError(false);
    }

    if (step === 0) {
      const words = fio.trim().split(" ");
      if (words.length < 3) {
        setFioError(true);
        return;
      }
      setFioError(false);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setEmailError(true);
        return;
      }
      setEmailError(false);

      if (!/^\+7\s\d{3}\s\d{3}-\d{2}-\d{2}$/.test(phone)) {
        setPhoneError(true);
        return;
      }
      setPhoneError(false);

      if (!agree) {
        setAgreeError(true);
        return;
      }
      setAgreeError(false);

      if (!user) {
        login({
          name: fio,
          email: email,
          phone: phone,
          isGuest: true,
        });
      }
    }

    if (step < 3) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const formatOrderNumber = (val: string | number | null | undefined) => {
    if (val == null) return "STG-000000";
    const n = String(val).replace(/\D/g, "");
    const padded = n.padStart(6, "0").slice(-6);
    return `STG-${padded}`;
  };

  // --- ОПЛАТА ---

  const handlePay = async (method: "sbp" | "card") => {
    if (paying) return;
    setPaying(true);
    try {
      let items = buildCheckoutItemsSync();
      items = await resolveMissingProductItemIds(items);

      const ready = items.filter(
        (i) =>
          (typeof i.productItemId === "number" &&
            Number.isFinite(i.productItemId)) ||
          (typeof i.productId === "number" && Number.isFinite(i.productId))
      );
      if (!ready.length) {
        console.error("[checkout] nothing to send, unresolved items", {
          cartItems,
          items,
        });
        setError(true);
        alert("Некорректные товары в корзине");
        return;
      }

      const payload = {
        items: ready.map((it: any) => {
          const { productItemId, productId, quantity, _raw } = it || {};
          const raw: any = _raw || {};
          const base: any = { quantity };

          base.price = getUnitPrice(raw);

          if (
            typeof productItemId === "number" &&
            Number.isFinite(productItemId)
          ) {
            base.productItemId = productItemId;
          } else if (
            typeof productId === "number" &&
            Number.isFinite(productId)
          ) {
            base.productId = productId;
          }

          const orig = Number(raw?.origPrice);
          const disc = Number(raw?.discountPercent ?? raw?.discount);
          if (Number.isFinite(orig)) base.origPrice = orig;
          if (Number.isFinite(disc)) base.discountPercent = disc;
          if (typeof raw?.name === "string") base.name = raw.name;
          if (typeof raw?.brandLogo === "string")
            base.brandLogo = raw.brandLogo;

          return base;
        }),
        address: address || "",
        phone: phone || "",
        fullName: fio || "",
        email: email || "",
        method,
        userId:
          user && !(user as any).isGuest && (user as any).id
            ? (user as any).id
            : undefined,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[checkout] failed:", res.status, text);
        setError(true);
        alert("Ошибка создания заказа: " + res.status);
        return;
      }

      const data = await res.json().catch(() => ({} as any));
      const orderIdFromServer = data?.orderId ?? data?.id;
      const token = data?.token;

      try {
        localStorage.removeItem("checkoutState");
      } catch {
        // ignore
      }

      if (orderIdFromServer) {
        const normalizedOrderId = String(orderIdFromServer);
        setOrderId(normalizedOrderId);
        try {
          localStorage.setItem("orderId", normalizedOrderId);
          document.cookie = `last_order_id=${normalizedOrderId}; Max-Age=900; Path=/`;
          localStorage.setItem("pendingPurchasedScope", "active-only");
        } catch {
          // ignore
        }
        router.push(`/mock-bank?orderId=${normalizedOrderId}`);
        return;
      }

      if (token) {
        try {
          localStorage.setItem("pendingPurchasedScope", "active-only");
        } catch {
          // ignore
        }
        router.push(`/mock-bank?token=${encodeURIComponent(token)}`);
        return;
      }

      alert("Не удалось получить номер заказа. Попробуйте ещё раз.");
    } catch (e) {
      console.error("[checkout] exception:", e);
      setError(true);
      alert("Не удалось оформить заказ. Попробуйте еще раз.");
    } finally {
      setPaying(false);
    }
  };

  // --- РЕНДЕР КОНТЕНТА ШАГОВ ---

  const renderStepContent = () => {
    if (showMap) return null;

    switch (step) {
      case 0:
        return (
          <motion.div
            key="step0"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-bold">Давайте познакомимся</h3>

            {user &&
              !user.isGuest &&
              fio === user.name &&
              email === user.email &&
              phone === user.phone && (
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle size={18} />
                  <span>Ваши данные вставлены из профиля</span>
                </div>
              )}

            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Адрес доставки
            </label>
            <div className="relative w-full">
              <input
                id="address"
                type="text"
                placeholder="Вы можете ввести адрес вручную или воспользоваться картой ---&gt;"
                value={address}
                onChange={(e) => {
                  const value = e.target.value;
                  setAddress(value);
                  saveCheckoutStatePartial({ address: value });
                }}
                className={`w-full p-2 border rounded placeholder-gray-400 ${
                  addressError ? "border-red-500" : ""
                }`}
              />
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="mt-3 px-6 py-4 border border-red-400 bg-red-100/70 text-red-900 rounded-2xl shadow-md flex items-center justify-between relative overflow-hidden"
              >
                <div className="flex items-center gap-3 text-sm font-medium">
                  <span className="text-lg">🚚</span>
                  <span>Условия доставки по Москве и РФ.</span>
                </div>
                <button
                  onClick={() => setShowRussiaInfo(true)}
                  className="ml-4 relative text-sm font-semibold text-black hover:text-black transition group"
                >
                  Подробнее
                  <motion.span
                    layoutId="underline"
                    className="block h-0.5 bg-black absolute left-0 bottom-0 w-0 group-hover:w-full transition-all duration-300"
                  />
                </button>
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                />
              </motion.div>
              <span
                onClick={() => setShowMap(true)}
                className="absolute right-3 top-2 cursor-pointer text-xl"
                title="Открыть карту"
              >
                🗺️
              </span>
            </div>
            {addressError && (
              <p className="text-sm text-red-500 mt-1">
                Введите корректный адрес
              </p>
            )}

            {user && !user.isGuest && (
              <div className="text-xs text-green-600 font-medium mb-1">
                ✅ Данные подставлены из профиля
              </div>
            )}

            <input
              type="text"
              placeholder={fioPlaceholder}
              value={fio}
              onChange={(e) => {
                const value = e.target.value;
                setFio(value);
                saveCheckoutStatePartial({ fio: value });
              }}
              className={`w-full p-2 border rounded placeholder-gray-400 ${
                fioError ? "border-red-500" : ""
              }`}
            />
            {fioError && (
              <p className="text-sm text-red-500 mt-1">
                Пожалуйста, введите полное ФИО
              </p>
            )}

            <div className="relative w-full">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  saveCheckoutStatePartial({ email: value });
                  if (value.includes("@")) {
                    setShowDomains(true);
                  } else {
                    setShowDomains(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showDomains) {
                    const [name, partial] = email.split("@");
                    const filtered = emailDomains.filter((domain) =>
                      domain.startsWith(partial)
                    );
                    if (filtered.length > 0) {
                      const value = `${name}@${filtered[0]}`;
                      setEmail(value);
                      saveCheckoutStatePartial({ email: value });
                      setShowDomains(false);
                    }
                  }
                }}
                onBlur={() => setTimeout(() => setShowDomains(false), 200)}
                className={`w-full p-2 border rounded pr-8 ${
                  emailError ? "border-red-500" : ""
                }`}
              />
              <div className="absolute right-2 top-2.5 text-gray-400 cursor-pointer group z-10">
                <span className="peer">ℹ️</span>
                <div className="absolute right-0 bottom-full mb-2 w-60 text-xs bg-gray-700 text-white p-2 rounded shadow-lg opacity-0 peer-hover:opacity-100 transition-opacity duration-300 z-50 text-left pointer-events-none">
                  На данный электронный адрес будет выслано письмо о заказе и его
                  содержимом.
                </div>
              </div>
              {showDomains && (
                <ul className="absolute z-40 mt-1 w-full bg-white border border-gray-300 rounded shadow text-sm max-h-40 overflow-y-auto">
                  {(() => {
                    const [name, partial] = email.split("@");
                    const filtered = emailDomains.filter((domain) =>
                      domain.startsWith(partial)
                    );
                    return filtered.map((domain) => (
                      <li
                        key={domain}
                        className="px-3 py-1 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          const value = `${name}@${domain}`;
                          setEmail(value);
                          saveCheckoutStatePartial({ email: value });
                          setShowDomains(false);
                        }}
                      >
                        {name}@{domain}
                      </li>
                    ));
                  })()}
                </ul>
              )}
              {emailError && (
                <p className="text-sm text-red-500 mt-1">
                  Введите корректный электронный адрес
                </p>
              )}
            </div>

            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-lg">
                🇷🇺
              </div>
              <input
                type="tel"
                placeholder="+7 123 456-78-90"
                value={phone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  setPhone(formatted);
                  saveCheckoutStatePartial({ phone: formatted });
                }}
                className={`w-full pl-10 p-2 border rounded ${
                  phoneError ? "border-red-500" : ""
                }`}
              />
            </div>
            {phoneError && (
              <p className="text-sm text-red-500 mt-1">
                Введите корректный номер телефона
              </p>
            )}

            <div className="text-xs text-gray-600 mt-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="accent-black mt-0.5"
                  checked={agree}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAgree(checked);
                    saveCheckoutStatePartial({ agree: checked });
                  }}
                />
                <span>
                  Я согласен(а) с{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    className="text-black underline-offset-4 hover:underline transition-all duration-200"
                  >
                    обработкой персональных данных
                  </a>{" "}
                  и{" "}
                  <a
                    href="/offer"
                    target="_blank"
                    className="text-black underline-offset-4 hover:underline transition-all duration-200"
                  >
                    публичной офертой
                  </a>
                </span>
              </label>
              {agreeError && (
                <p className="text-sm text-red-500 mt-1">
                  Пожалуйста, подтвердите согласие
                </p>
              )}
            </div>

            <button
              onClick={goNext}
              className="w-full py-2 bg-black text-white rounded"
            >
              Продолжить
            </button>
          </motion.div>
        );

      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-bold">Проверьте заказ</h3>
            <div className="space-y-2">
              <p>Товаров к оплате: {activeCount}</p>
              <p>
                Сумма к оплате:{" "}
                {discountedTotal.toLocaleString("ru-RU")} ₽
              </p>
              {cartItems.length > activeCount && (
                <p className="text-xs text-gray-500">
                  * Отложенные товары не включены в оплату
                </p>
              )}
              <div className="group inline-block">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="relative text-sm text-black transition"
                >
                  {showDetails ? "Скрыть товары" : "Показать товары"}
                  <span className="absolute left-0 -bottom-0.5 h-0.5 w-full scale-x-0 bg-black transition-transform duration-300 origin-left group-hover:scale-x-100" />
                </button>
              </div>
              <AnimatePresence initial={false}>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ul className="border p-2 rounded max-h-40 overflow-y-auto text-sm space-y-1 mt-2">
                      {activeCartItems.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex justify-between"
                        >
                          <span>
                            {item.name} × {item.quantity ?? 1}
                          </span>
                          {(() => {
                            const q = Number(item?.quantity ?? 1);
                            const unit = getUnitPrice(item);
                            const baseTotal = unit * q;
                            const total =
                              baseTotal *
                              (discount > 0 ? 1 - discount : 1);

                            const origLocal = num(
                              (item as any)?.origPrice ??
                                (item as any)?.oldPrice ??
                                (item as any)?.basePrice ??
                                (item as any)?.originalPrice
                            );
                            const percLocal = num(
                              (item as any)?.discountPercent ??
                                (item as any)?.discount
                            );
                            const hadDisc =
                              Number.isFinite(origLocal) &&
                              Number.isFinite(percLocal) &&
                              percLocal > 0 &&
                              Math.round(
                                (origLocal * (100 - percLocal)) / 100
                              ) !== unit;
                            const origTotal = hadDisc
                              ? origLocal * q
                              : 0;

                            return (
                              <span>
                                {hadDisc || discount > 0 ? (
                                  <span className="line-through text-gray-400 mr-2">
                                    {(
                                      discount > 0
                                        ? baseTotal
                                        : origTotal
                                    ).toLocaleString("ru-RU")}{" "}
                                    ₽
                                  </span>
                                ) : null}
                                <span>
                                  {total.toLocaleString("ru-RU")} ₽
                                </span>
                              </span>
                            );
                          })()}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex justify-between">
              <button
                onClick={goBack}
                className="py-2 px-4 border rounded"
              >
                Назад
              </button>
              <button
                onClick={goNext}
                className="py-2 px-4 bg-black text-white rounded"
              >
                К оплате
              </button>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-bold mb-4">
              Каким способом вам удобнее оплатить?
            </h3>
            {activeCount === 0 && (
              <p className="text-sm text-red-600 -mt-2">
                В корзине нет активных товаров для оплаты. Отложенные
                позиции не оплачиваются.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => handlePay("sbp")}
                disabled={paying || activeCount === 0}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded text-white transition ${
                  paying
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:opacity-90"
                } bg-[#14174d]`}
              >
                <img
                  src="/img/сбп.png"
                  alt="СБП"
                  className="h-10 w-auto"
                />
                <span>
                  {paying ? "Обработка..." : "Оплатить через СБП"}
                </span>
              </button>
              <button
                onClick={() => handlePay("card")}
                disabled={paying || activeCount === 0}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded border transition ${
                  paying
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:bg-black hover:text-white"
                } bg-white text-black`}
              >
                <span role="img" aria-label="card">
                  💳
                </span>
                <span>
                  {paying
                    ? "Обработка..."
                    : "Оплатить банковской картой"}
                </span>
              </button>
            </div>
            {error && (
              <p className="text-red-600 text-sm mt-3">
                ❌ Оплата не прошла, попробуйте ещё раз.
              </p>
            )}
          </motion.div>
        );

      case 3:
        const isSuccess = paymentStatus === "success";
        const isFail = paymentStatus === "fail";
        return (
          <motion.div
            key="step3"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative text-center space-y-4 py-6"
          >
            {isSuccess && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 80 }).map((_, i) => {
                  const left = Math.random() * 100;
                  const delay = Math.random() * 2;
                  const duration = 2.5 + Math.random() * 2;
                  const size = 6 + Math.random() * 6;
                  const colors = [
                    "#10b981",
                    "#f59e0b",
                    "#3b82f6",
                    "#ef4444",
                    "#a855f7",
                  ];
                  const color = colors[i % colors.length];
                  return (
                    <span
                      key={i}
                      className="absolute rounded-sm"
                      style={{
                        left: `${left}%`,
                        width: size,
                        height: size * 2,
                        background: color,
                        opacity: 0.9,
                        animation: `confetti-fall ${duration}s linear ${delay}s forwards`,
                      }}
                    />
                  );
                })}
              </div>
            )}
            <div className="text-5xl relative z-10">
              {isSuccess ? "✨" : isFail ? "❌" : "😊"}
            </div>
            <h3 className="text-2xl font-bold">
              {isSuccess
                ? "Ваш заказ успешно оплачен"
                : isFail
                ? "Заказ не был оплачен"
                : "Спасибо за заказ!"}
            </h3>
            {isSuccess ? (
              <>
                <p className="text-gray-600">
                  Номер заказа: {formatOrderNumber(orderId)}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      router.push("/user?tab=orders");
                      handleUserClose();
                    }}
                    className="px-4 py-2 bg-black text-white rounded-xl shadow-lg shadow-black/20 hover:-translate-y-0.5 transition"
                  >
                    Перейти к заказам
                  </button>
                  <button
                    onClick={handleUserClose}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:border-black/40 transition"
                  >
                    Закрыть
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-600">
                  Заказ не был оплачен. Пожалуйста, повторите оплату. Если
                  возникли проблемы, напишите нам.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                  <a
                    href="https://t.me/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:border-black/40 transition"
                  >
                    Telegram
                  </a>
                  <a
                    href="mailto:support@stagestore.ru"
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:border-black/40 transition"
                  >
                    support@stagestore.ru
                  </a>
                  <button
                    onClick={handleUserClose}
                    className="px-4 py-2 bg-black text-white rounded-xl shadow-lg shadow-black/20 hover:-translate-y-0.5 transition"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        );
    }
  };

  const stepIcons = [User, ClipboardCheck, CreditCard, Smile];

  const Stepper = () => {
    if (isMobile) {
      return (
        <div className="flex items-center gap-3 w-full">
          {steps.map((label, index) => {
            const Icon = stepIcons[index];
            return (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center text-center gap-1 flex-shrink-0">
                  <div
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition ${
                      index <= step
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-400 border-gray-300"
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  <span
                    className={`text-[11px] ${
                      index === step
                        ? "font-semibold text-black"
                        : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-px bg-gray-200">
                    <div
                      className={`h-px ${
                        step > index ? "bg-black w-full" : "bg-gray-200 w-0"
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 w-full">
        {steps.map((label, index) => {
          const Icon = stepIcons[index];
          return (
            <div key={label} className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-sm font-semibold transition ${
                  index <= step
                    ? "bg-black text-white border-black"
                    : "bg-white border-gray-200 text-gray-400"
                }`}
              >
                <Icon size={18} />
              </div>
              <div className="flex flex-col">
                <span
                  className={`text-sm ${
                    index === step
                      ? "font-semibold text-black"
                      : "text-gray-500"
                  }`}
                >
                  {label}
                </span>
                {index < steps.length - 1 && (
                  <span className="text-xs text-gray-400">
                    Шаг {index + 1} из {steps.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // (auth gating removed)

  return open ? (
    <AnimatePresence>
      <React.Fragment key="checkout-root">
        <motion.div
          key="checkout-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] flex items-start justify-center bg-black/45 backdrop-blur-sm p-3 sm:p-6 pt-16 sm:pt-20"
        >
          <motion.div
            key="checkout-card"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-5xl bg-white rounded-[28px] shadow-2xl flex flex-col lg:flex-row overflow-hidden max-h-[90vh]"
          >
            <button
              onClick={handleUserClose}
              className="hidden lg:block absolute top-4 right-4 text-gray-500 hover:text-black text-3xl z-20"
              aria-label="Закрыть оформление"
            >
              ×
            </button>
            <div className="lg:w-1/3 w-full bg-gray-50/90 border-b lg:border-b-0 lg:border-r border-gray-100 px-5 py-5">
              <Stepper />
            </div>
            <div className="flex-1 flex flex-col min-h-0 bg-white">
              <div className="px-5 sm:px-7 py-5 border-b border-gray-100 bg-white/90 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-1">
                      Оформление заказа
                    </p>
                    <h2 className="text-2xl font-semibold text-gray-900">
                      {showMap ? "Выберите адрес" : "Давайте завершим"}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {showMap
                        ? address
                          ? `Выбранный адрес: ${address}`
                          : "Нажмите на карту, чтобы указать точку"
                        : "После успешной оплаты данные о заказе появятся в вашем профиле в разделе «Мои заказы»"}
                    </p>
                  </div>
                  <button
                    onClick={handleUserClose}
                    className="lg:hidden text-gray-500 hover:text-black text-2xl leading-none px-2"
                    aria-label="Закрыть оформление"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
                <AnimatePresence mode="wait">
                  {renderStepContent()}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {showMap && (
            <motion.div
              key="map-popover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-3xl w-full max-w-2xl h-[520px] relative shadow-2xl overflow-hidden"
              >
                <button
                  onClick={() => setShowMap(false)}
                  className="absolute top-4 right-5 text-2xl text-gray-500 hover:text-black z-10"
                >
                  ×
                </button>
                <div className="h-full w-full">
                  <YMaps query={{ apikey: "6ff09043-a633-4dfc-aee3-96794db4de23" }}>
                    <YMap
                      defaultState={{
                        center: [55.751574, 37.573856],
                        zoom: 9,
                      }}
                      width="100%"
                      height="100%"
                      onClick={handleMapClick}
                    >
                      {coordinates && <Placemark geometry={coordinates} />}
                    </YMap>
                  </YMaps>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-sm p-4 border-t border-gray-100">
                  <button
                    className="w-full py-3 rounded-xl bg-black text-white font-semibold"
                    onClick={() => {
                      if (!address || address.trim().length < 5) {
                        setAddressError(true);
                        return;
                      }
                      setAddressError(false);
                      saveCheckoutStatePartial({ address });
                      setShowMap(false);
                    }}
                  >
                    Выбрать этот адрес
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <DeliveryInfoModal
          open={showMoscowInfo || showRussiaInfo}
          variant={showRussiaInfo ? "russia" : "moscow"}
          onClose={() => {
            setShowMoscowInfo(false);
            setShowRussiaInfo(false);
          }}
        />

        <style jsx global>{`
          @keyframes confetti-fall {
            0% {
              transform: translateY(-20vh) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(110vh) rotate(360deg);
              opacity: 0.6;
            }
          }
        `}</style>
      </React.Fragment>
    </AnimatePresence>
  ) : null;
}