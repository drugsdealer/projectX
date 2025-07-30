"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { YMaps, Map, Placemark } from "@pbe/react-yandex-maps";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, User, ClipboardCheck, CreditCard, Smile, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useUser } from "@/user/UserContext";

const steps = ["ФИО", "Подтверждение", "Оплата", "Ответ"];

export default function CheckoutModal({ visible, onClose }: { visible: boolean, onClose: () => void }) {
  const [step, setStep] = useState(0);
  const showModal = visible;
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    const queryStatus = new URLSearchParams(window.location.search).get("status");
    if (queryStatus === "success") {
      setStep(3); // Перейти на шаг "Ответ"
    } else if (queryStatus === "failed") {
      setError(true); // Показать ошибку
      setStep(3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Address states
  const [address, setAddress] = useState(() => localStorage.getItem("address") || "");
  const [addressError, setAddressError] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [detectedCity, setDetectedCity] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);

  // new states for city and modals
  const [city, setCity] = useState("");
  const [showMoscowInfo, setShowMoscowInfo] = useState(false);
  const [showRussiaInfo, setShowRussiaInfo] = useState(false);

  const [showDetails, setShowDetails] = useState(false);
  const { cartItems } = useCart();
  const { user, login, logout } = useUser();

  const [orderId, setOrderId] = useState(() => {
    const saved = localStorage.getItem("orderId");
    if (saved) return saved;
    const generated = `#${Math.floor(100000 + Math.random() * 900000)}`;
    localStorage.setItem("orderId", generated);
    return generated;
  });
  const [fio, setFio] = useState(() => localStorage.getItem("fio") || "");
  const [email, setEmail] = useState(() => localStorage.getItem("email") || "");
  const [phone, setPhone] = useState(() => localStorage.getItem("phone") || "");
  const [agree, setAgree] = useState(false);

  // Восстановление состояния из localStorage при монтировании
  useEffect(() => {
    const saved = localStorage.getItem("checkoutState");
    if (saved) {
      const parsed = JSON.parse(saved);
      setStep(parsed.step ?? 0);
      setFio(parsed.fio ?? "");
      setEmail(parsed.email ?? "");
      setPhone(parsed.phone ?? "");
      setAgree(parsed.agree ?? false);
      setOrderId(parsed.orderId ?? `#${Math.floor(100000 + Math.random() * 900000)}`);
    }
  }, []);
  useEffect(() => {
    if (user && !user.isGuest) {
      setFio(user.name);
      setEmail(user.email);
      setPhone(user.phone);
    }
  }, [user]);
  useEffect(() => {
    localStorage.setItem("fio", fio);
  }, [fio]);

  useEffect(() => {
    localStorage.setItem("email", email);
  }, [email]);

  useEffect(() => {
    localStorage.setItem("phone", phone);
  }, [phone]);

  useEffect(() => {
    localStorage.setItem("address", address);
  }, [address]);

  // Сохранение состояния в localStorage при изменении ключевых полей
  useEffect(() => {
    const state = {
      step,
      fio,
      email,
      phone,
      agree,
      orderId
    };
    localStorage.setItem("checkoutState", JSON.stringify(state));
    localStorage.setItem("orderId", orderId);
  }, [step, fio, email, phone, agree, orderId]);
  const [fioError, setFioError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const [agreeError, setAgreeError] = useState(false);

  const emailDomains = useMemo(() => ["gmail.com", "yahoo.com", "outlook.com", "mail.ru", "icloud.com", "yandex.ru"], []);

  const fioExamples = ["Иванов Иван Иванович", "Сергеев Сергей Сергеевич", "Петров Пётр Петрович"];
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
          setTimeout(() => {}, 1000);
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

  const geocodeAddress = useCallback(async (addr: string) => {
  if (!addr.trim()) return "";
  setIsGeocoding(true);
  try {
    const response = await fetch(
      `https://geocode-maps.yandex.ru/1.x/?apikey=6ff09043-a633-4dfc-aee3-96794db4de23&format=json&geocode=${encodeURIComponent(addr)}`
    );
    const data = await response.json();
    const found = data?.response?.GeoObjectCollection?.featureMember?.[0];
    if (found) {
      const components = found.GeoObject.metaDataProperty?.GeocoderMetaData?.Address?.Components || [];
      const cityComponent = components.find((c: any) => c.kind === "locality" || c.kind === "province");
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
}, []);

  // Функция для обработки клика по карте
  const handleMapClick = async (e: any) => {
    const coords = e.get("coords");
    setCoordinates(coords);
    try {
      const response = await fetch(
        `https://geocode-maps.yandex.ru/1.x/?apikey=6ff09043-a633-4dfc-aee3-96794db4de23&format=json&geocode=${coords[1]},${coords[0]}`
      );
      const data = await response.json();
      const found = data?.response?.GeoObjectCollection?.featureMember?.[0];
      if (found) {
        const fullAddress = found.GeoObject.name;
        setAddress(fullAddress);
      }
    } catch (error) {
      console.error("Ошибка геокодирования:", error);
    }
  };

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
      // Если пользователь не вошел, создаём гостевой профиль
      if (!user) {
        login({
          name: fio,
          email: email,
          phone: phone,
          isGuest: true
        });
      }
    }
    if (step < 3) setStep(step + 1);
    if (step === 1) {
      router.push("/mock-bank");
      return;
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

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
            {(user && !user.isGuest && fio === user.name && email === user.email && phone === user.phone) && (
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <CheckCircle size={18} />
                <span>Ваши данные вставлены из профиля</span>
              </div>
            )}
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Адрес доставки</label>
            <div className="relative w-full">
              <input
                id="address"
                type="text"
                placeholder="Вы можете ввести адрес вручную или воспользоваться картой ---&gt;"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full p-2 border rounded placeholder-gray-400 ${addressError ? 'border-red-500' : ''}`}
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
              <p className="text-sm text-red-500 mt-1">Введите корректный адрес</p>
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
              onChange={(e) => setFio(e.target.value)}
              className={`w-full p-2 border rounded placeholder-gray-400 ${fioError ? 'border-red-500' : ''}`}
            />
            {fioError && (
              <p className="text-sm text-red-500 mt-1">Пожалуйста, введите полное ФИО</p>
            )}
            <div className="relative w-full">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (e.target.value.includes("@")) {
                    setShowDomains(true);
                  } else {
                    setShowDomains(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showDomains) {
                    const [name, partial] = email.split("@");
                    const filtered = emailDomains.filter((domain) => domain.startsWith(partial));
                    if (filtered.length > 0) {
                      setEmail(`${name}@${filtered[0]}`);
                      setShowDomains(false);
                    }
                  }
                }}
                onBlur={() => setTimeout(() => setShowDomains(false), 200)}
                className={`w-full p-2 border rounded pr-8 ${emailError ? 'border-red-500' : ''}`}
              />
              <div className="absolute right-2 top-2.5 text-gray-400 cursor-pointer group z-10">
                <span className="peer">ℹ️</span>
                <div className="absolute right-0 bottom-full mb-2 w-60 text-xs bg-gray-700 text-white p-2 rounded shadow-lg opacity-0 peer-hover:opacity-100 transition-opacity duration-300 z-50 text-left pointer-events-none">
                  На данный электронный адрес будет выслано письмо о заказе и его содержимом.
                </div>
              </div>
              {showDomains && (
                <ul className="absolute z-40 mt-1 w-full bg-white border border-gray-300 rounded shadow text-sm max-h-40 overflow-y-auto">
                  {(() => {
                    const [name, partial] = email.split("@");
                    const filtered = emailDomains.filter((domain) => domain.startsWith(partial));
                    return filtered.map((domain) => (
                      <li
                        key={domain}
                        className="px-3 py-1 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setEmail(`${name}@${domain}`);
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
                <p className="text-sm text-red-500 mt-1">Введите корректный электронный адрес</p>
              )}
            </div>
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-lg">🇷🇺</div>
              <input
                type="tel"
                placeholder="+7 123 456-78-90"
                value={phone}
                onChange={(e) => {
                  let digits = e.target.value.replace(/\D/g, "");
                  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
                  if (!digits.startsWith("7")) digits = "7" + digits;
                  let formatted = "+7";
                  if (digits.length > 1) formatted += " " + digits.slice(1, 4);
                  if (digits.length >= 4) formatted += " " + digits.slice(4, 7);
                  if (digits.length >= 7) formatted += "-" + digits.slice(7, 9);
                  if (digits.length >= 9) formatted += "-" + digits.slice(9, 11);
                  setPhone(formatted);
                }}
                className={`w-full pl-10 p-2 border rounded ${phoneError ? 'border-red-500' : ''}`}
              />
            </div>
            {phoneError && (
              <p className="text-sm text-red-500 mt-1">Введите корректный номер телефона</p>
            )}
            <div className="text-xs text-gray-600 mt-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="accent-black mt-0.5"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
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
                <p className="text-sm text-red-500 mt-1">Пожалуйста, подтвердите согласие</p>
              )}
            </div>
            <button onClick={goNext} className="w-full py-2 bg-black text-white rounded">Продолжить</button>
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
              <p>Товаров: {cartItems.length}</p>
              <p>Сумма: {cartItems.reduce((sum, item) => sum + Number(item.price) * (item.quantity ?? 1), 0).toLocaleString()} ₽</p>
              <div className="group inline-block">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="relative text-sm text-black transition"
                >
                  {showDetails ? "Скрыть товары" : "Показать товары"}
                  <span
                    className="absolute left-0 -bottom-0.5 h-0.5 w-full scale-x-0 bg-black transition-transform duration-300 origin-left group-hover:scale-x-100"
                  />
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
                      {cartItems.map((item, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>{item.name} × {item.quantity ?? 1}</span>
                          <span>{(item.price * (item.quantity ?? 1)).toLocaleString()} ₽</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex justify-between">
              <button onClick={goBack} className="py-2 px-4 border rounded">Назад</button>
              <button onClick={goNext} className="py-2 px-4 bg-black text-white rounded">К оплате</button>
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
            <h3 className="text-xl font-bold mb-4">Каким способом вам удобнее оплатить?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setStep(3)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded bg-[#14174d] text-white hover:opacity-90 transition"
              >
                <img src="/img/сбп.png" alt="СБП" className="h-10 w-auto" />
                <span>Оплатить через СБП</span>
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded bg-white text-black border hover:bg-black hover:text-white transition"
              >
                <span role="img" aria-label="card">💳</span>
                <span>Оплатить банковской картой</span>
              </button>
            </div>
            {error && <p className="text-red-600 text-sm mt-3">❌ Оплата не прошла, попробуйте ещё раз.</p>}
          </motion.div>
        );
      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-4"
          >
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <h3 className="text-xl font-bold">Спасибо за заказ!</h3>
            <p className="text-gray-600">Мы свяжемся с вами в ближайшее время.</p>
            <button
              onClick={() => {
                onClose();
                localStorage.removeItem("checkoutState");
              }}
              className="mt-4 px-4 py-2 bg-black text-white rounded"
            >
              Закрыть
            </button>
          </motion.div>
        );
    }
  };


  return showModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`absolute left-50 -translate-x-1/2 top-12 text-center z-[60] max-w-xl w-full px-4 transition-all duration-300`}
        >
          <h2 className="text-3xl font-extrabold text-black tracking-wide drop-shadow-md text-center max-w-2xl mx-auto">
            {showMap ? "Выберите адрес" : "Оформление заказа"}
          </h2>
          <p className="text-base font-semibold text-gray-600 mt-1">
            {showMap
              ? address
                ? `Выбранный адрес: ${address}`
                : "Нажмите на карту, чтобы выбрать адрес"
              : `Ваш номер заказа: ${orderId}`}
          </p>
        </motion.div>
      <div className="bg-white rounded-xl shadow-xl flex w-full max-w-4xl overflow-hidden relative">
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="absolute top-4 right-6 text-gray-500 hover:text-black text-3xl z-[70]"
          aria-label="Закрыть оформление"
        >
          ×
        </button>
        {/* Левая панель шагов */}
        <div className="w-1/3 bg-gray-50 p-6 flex flex-col items-start gap-6">
          {(() => {
            const stepIcons = [User, ClipboardCheck, CreditCard, Smile];
            return steps.map((label, index) => {
              const Icon = stepIcons[index];
              const isActive = index === step;
              const isPassed = index < step;
              return (
                <div key={index} className="flex items-center gap-3 relative w-full">
                  <div className={`relative`}>
                    <div className={`w-6 h-6 rounded-full transition-all duration-300 border-2 flex items-center justify-center ${
                      index <= step ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      <Icon size={14} />
                    </div>
                    {/* connecting line */}
                    {index < steps.length - 1 && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-6 w-1 h-10 bg-gray-300 overflow-hidden">
                        <motion.div
                          initial={false}
                          animate={{
                            y: step > index ? 0 : -40,
                            opacity: step > index ? 1 : 0
                          }}
                          transition={{ duration: 0.5 }}
                          className="absolute top-0 left-0 w-full h-full flex justify-center items-center"
                        >
                          <ShoppingCart size={70} className="text-green-500" />
                        </motion.div>
                      </div>
                    )}
                  </div>
                  <span className={`text-sm ${isActive ? 'font-bold text-black' : 'text-gray-500'}`}>{label}</span>
                </div>
              );
            });
          })()}
        </div>

        {/* Правая панель с анимацией */}
        <div className="flex-1 p-6 relative">
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>
          <AnimatePresence>
            {showMap && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-50 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <div className="bg-white p-4 rounded-xl relative w-full max-w-2xl h-[500px]">
                  <button
                    onClick={() => setShowMap(false)}
                    className="absolute top-3 right-4 text-gray-500 hover:text-black text-2xl"
                  >
                    ×
                  </button>
                  <YMaps query={{ apikey: "6ff09043-a633-4dfc-aee3-96794db4de23" }}>
                    <Map
                      defaultState={{ center: [55.751574, 37.573856], zoom: 9 }}
                      width="100%"
                      height="100%"
                      onClick={handleMapClick}
                    >
                      {coordinates && <Placemark geometry={coordinates} />}
                    </Map>
                  </YMaps>
                  <button
                    className="mt-4 px-4 py-2 bg-black text-white rounded w-full"
                    onClick={() => {
                      if (!address || address.trim().length < 5) {
                        setAddressError(true);
                        return;
                      }
                      setAddressError(false);
                      setShowMap(false);
                    }}
                  >
                    Подтвердить адрес
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    {/* Модальные окна для доставки */}
    {showMoscowInfo && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 rounded shadow-xl max-w-md w-full relative"
        >
          <button
            onClick={() => setShowMoscowInfo(false)}
            className="absolute top-2 right-3 text-2xl text-gray-500 hover:text-black"
          >
            ×
          </button>
          <h3 className="text-lg font-bold mb-3 text-center">Доставка по Москве и области</h3>
          <ul className="text-sm space-y-2 list-disc pl-5 text-gray-700">
            <li>
              <strong>Самовывоз</strong> доступен по адресу: Москва, ул. Примерная, д. 10. Уточните доступность по телефону.
            </li>
            <li>
              <strong>Курьерская доставка</strong> по Москве — <span className="font-semibold">499 ₽</span>.
            </li>
          </ul>
        </motion.div>
      </div>
    )}
    {showRussiaInfo && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 rounded-xl shadow-xl max-w-xl w-full relative"
        >
          <button
            onClick={() => setShowRussiaInfo(false)}
            className="absolute top-2 right-3 text-2xl text-gray-500 hover:text-black"
          >
            ×
          </button>
          <h3 className="text-2xl font-bold mb-4 text-center">Условия доставки по Москве и РФ</h3>
          <div className="space-y-4 text-gray-800 text-sm">
            <div>
              <h4 className="text-lg font-semibold text-black mb-1">📦 Доставка по Москве:</h4>
              <p className="leading-relaxed">
                Мы предлагаем два удобных варианта получения вашего заказа в пределах Москвы:
              </p>
              <ul className="list-disc ml-5 mt-1">
                <li>
                  <strong>Самовывоз</strong> — доступен по адресу: Москва, ул. Примерная, д. 10. График работы с 10:00 до 21:00.
                </li>
                <li>
                  <strong>Курьерская доставка</strong> — осуществляется по городу Москве. Стоимость услуги — <strong>499 ₽</strong>. Курьер доставит ваш заказ до двери в удобное для вас время.
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-black mb-1">🚚 Доставка по России:</h4>
              <p className="leading-relaxed">
                После поступления вашего заказа в Москву, наш менеджер свяжется с вами. Далее вы сможете выбрать любую транспортную компанию, которая осуществит доставку в ваш регион.
                <br />
                Организация и стоимость доставки по России осуществляется <strong>за счёт клиента</strong> и по его выбору.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
              <img src="/img/CDEK_logo.svg.png" alt="СДЭК" className="h-8 object-contain" />
              <img src="/img/berry.png" alt="Boxberry" className="h-8 object-contain" />
              <img src="/img/post.png" alt="Почта России" className="h-8 object-contain" />
              <img src="/img/pek.png" alt="ПЭК" className="h-8 object-contain" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Если у вас остались вопросы, свяжитесь с нашей службой поддержки — мы с радостью поможем вам!</p>
          </div>
        </motion.div>
      </div>
    )}
    </div>
  ) : null;
}