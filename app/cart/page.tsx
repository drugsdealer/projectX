'use client';

import React, { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useDiscount } from "@/context/DiscountContext";
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { Product, products } from "@/data/products";
import { useToast } from "@/components/ui/use-toast";
import dynamic from "next/dynamic";

export default function CartPage() {
  const { cartItems, removeFromCart, postponedItems, setPostponedItems, togglePostponed } = useCart();
  const { discount, setDiscount, resetDiscount } = useDiscount();
  const { showToast } = useToast();

  const [promoCode, setPromoCode] = useState('');
  const [inputBounceTrigger, setInputBounceTrigger] = useState(0);
  const [applied, setApplied] = useState(false);
  const [promoError, setPromoError] = useState(false);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [hasCheckoutData, setHasCheckoutData] = useState(false);
  useEffect(() => {
    const savedCheckout = localStorage.getItem("checkoutState");
    if (savedCheckout) {
      setHasCheckoutData(true);
    }
  }, []);
  const CheckoutModal = dynamic(() => import("@/components/CheckoutModal"), { ssr: false });

  // Определяем премиум-товар по данным каталога
  const isPremiumProduct = (id: number) => {
    const src = products.find(p => p.id === id) as any;
    return !!(src?.isPremium || src?.premium || src?.category === 'premium' || src?.tags?.includes?.('premium'));
  };

  const handleRemove = (index: number) => {
    const item = cartItems[index];
    removeFromCart(index);
    if (cartItems.length === 1) {
      resetDiscount();
      setApplied(false);
    }
  };

useEffect(() => {
  const viewedIds = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
  const viewedProducts = viewedIds
    .map((id: number) => products.find(p => p.id === id))
    .filter((p: Product | undefined): p is Product => !!p)
    .slice(0, 6);

  setRecentProducts(viewedProducts);
  setTimeout(() => {
    setLoadingRecent(false);
  }, 800);
}, []);

  // Загрузка состояния промокода
  useEffect(() => {
    const storedPromo = localStorage.getItem("promoCode");
    const storedDiscount = localStorage.getItem("discount");

    if (storedPromo && storedDiscount && !applied) {
      setPromoCode(storedPromo);
      setApplied(true);
      setDiscount(parseFloat(storedDiscount));
    }
  }, []);

  // Сброс промокода, если корзина пуста
  useEffect(() => {
    if (cartItems.length === 0) {
      resetDiscount();
      setApplied(false);
    }
  }, [cartItems]);

  // Применение промокода
  const handleApplyPromo = () => {
    if (promoCode.trim().toLowerCase() === "stage10", "zelenskiypidor10") {
      setDiscount(0.1);
      localStorage.setItem("promoCode", promoCode);
      setApplied(true);
      setPromoError(false);
    } else {
      resetDiscount();
      setApplied(false);
      setPromoError(true);
    }
  };

  const activeCartItems = cartItems.filter(item => !postponedItems.includes(item.id));
  const total = activeCartItems.reduce((sum, item) => sum + item.price, 0);
  const discountedTotal = total * (1 - discount);

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
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
                            src={item.images[0]}
                            alt={item.name}
                            fill
                            className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-3">
                          <h3 title={item.name} className="text-sm font-semibold text-gray-800 group-hover:text-black truncate">
                            {isPremiumProduct(item.id) && <span className="text-black mr-1" aria-label="premium">★</span>}
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {(() => {
                              const sizes = (item as any)?.sizes;
                              if (sizes?.prices) {
                               const minPrice = Math.min(...Object.values(sizes.prices) as number[]);
                                return `от ${minPrice.toLocaleString('ru-RU')}₽`;
                              }
                              return `${item.price.toLocaleString('ru-RU')}₽`;
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
          <div className="space-y-6">
            {cartItems.map((item, index) => (
              <Link key={index} href={`/product/${item.id}`} className="block">
                <div className="flex items-center gap-6 border-b pb-4 transition">
                  <div className="relative w-24 h-24 flex-shrink-0">
                    
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover rounded"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3
                        title={item.name}
                        className={`flex-1 truncate font-semibold ${postponedItems.includes(item.id) ? 'line-through text-gray-400' : ''}`}
                      >
                        {item.name}
                      </h3>
                      {isPremiumProduct(item.id) && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black text-white border border-black/20">
                          <span aria-hidden>★</span>
                          <span className="hidden sm:inline">Premium</span>
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500">
                      {item.name.toLowerCase().includes("parfum") || item.name.toLowerCase().includes("духи")
                        ? `Объем: ${item.size} мл`
                        : `Размер: ${item.size}`}
                    </p>
                    {/* Булавка для отложенных */}
                  </div>
                  <div className="text-lg font-bold whitespace-nowrap">
                    {applied ? (
                      <>
                        <span className="line-through text-gray-400 mr-2">${item.price.toLocaleString()}</span>
                        <span>${(item.price * (1 - discount)).toLocaleString()}</span>
                      </>
                    ) : (
                      <span>${item.price.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center relative group" aria-label="Отложить товар">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        togglePostponed(item.id);
                        const isPostponed = postponedItems.includes(item.id);
                        setTimeout(() => {
                          showToast({
                            title: isPostponed ? 'Возвращён в корзину' : 'Товар отложен',
                            details: item.name,
                          });
                        }, 0);
                      }}
                      className={`transition-transform duration-300 hover:scale-110 ${
                        postponedItems.includes(item.id) ? 'text-yellow-500' : 'text-gray-400'
                      }`}
                    >
                      📌
                    </button>

                    {/* Подпись для мобильных */}
                    <p className="block sm:hidden text-xs text-gray-400 mt-1">Отложить</p>

                    {/* Тултип для десктопа */}
                    <div className="hidden sm:block absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition">
                      Отложить
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(index);
                    }}
                    className="text-gray-400 hover:text-red-600 transition-transform duration-300 hover:scale-110"
                    aria-label="Удалить"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </Link>
            ))}
          </div>

          {/* Промокод */}
          <div className="mt-10">
            <h3 className="text-lg font-semibold mb-3">Промокод</h3>
            <div className={`max-w-md bg-white rounded-xl shadow p-4 flex items-center gap-3 border transition duration-300
              ${promoCode.length > 0 ? 'border-black ring-2 ring-black' : 'border-gray-200'}
            `}>
              <motion.span
                key={inputBounceTrigger}
                className="text-xl"
                animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                transition={{ duration: 0.6 }}
              >
                🎁
              </motion.span>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setInputBounceTrigger(prev => prev + 1);
                }}
                placeholder="Введите промокод"
                className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400"
              />
              <button
                onClick={handleApplyPromo}
                className="bg-black text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition font-medium"
              >
                Применить
              </button>
            </div>
            {applied && (
              <p className="text-green-600 text-sm mt-2">
                ✅ Промокод применен. Скидка {discount * 100}%
              </p>
            )}
            {promoError && (
              <p className="text-red-600 text-sm mt-2">
                ❌ Промокод недействителен, попробуй ещё раз!
              </p>
            )}
          </div>

          {/* Итог + кнопка */}
          <div className="mt-6 flex justify-between items-center border-t pt-6">
            <div>
              <h2 className="text-xl font-semibold">Итого:</h2>
              {applied && (
                <>
                  <p className="text-sm text-gray-500">Скидка: {discount * 100}%</p>
                  <p className="text-sm text-gray-400">
                    Учтено товаров: {activeCartItems.length} из {cartItems.length}
                  </p>
                </>
              )}
            </div>
            <div className="mt-8 flex justify-end items-center gap-6">
              <div className="text-right">
                <p className="text-xl font-bold">
                  ${discountedTotal.toLocaleString()}
                </p>
                {discount > 0 && (
                  <p className="text-sm text-gray-400 line-through">
                    ${total.toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowCheckout(true)}
                className="group relative px-5 py-2.5 bg-black text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300"
              >
                <span>{hasCheckoutData ? "Продолжить оформление" : "Перейти к оформлению"}</span>
                <span className="opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </>
      )}
      <CheckoutModal visible={showCheckout} onClose={() => setShowCheckout(false)} />
    </div>
  );
}