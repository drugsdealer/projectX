"use client"; // Это директива, указывающая, что компонент должен работать на клиенте

import React, { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel } from "swiper/modules";
import "swiper/css";
import "swiper/css/mousewheel";
import { motion, AnimatePresence } from "framer-motion";

// Добавьте этот объект перед компонентом:
const sizeChart = {
  39: { us: 6, cm: 24 },
  40: { us: 7, cm: 25 },
  41: { us: 8, cm: 26 },
  42: { us: 9, cm: 27 },
  43: { us: 10, cm: 28 },
  44: { us: 11, cm: 29 },
};

const productsData = {
  footwear: [
    {
      id: 1,
      name: "Yeezy 350",
      description: "Кроссовки Yeezy 350 с уникальным дизайном.",
      images: ["/img/yeezy350v3.jpg", "/img/yeezy-900.jpg", "/img/yeezy350v2.jpg"],
      price: 500,
      sizes: [39, 40, 41, 42, 43],
      inStock: true,
    },
    {
      id: 2,
      name: "Nike Air Max",
      description: "Стильные кроссовки Nike Air Max с хорошей амортизацией.",
      images: ["/img/nike_air_max.jpg", "/img/nike_air_max2.jpg"],
      price: 600,
      sizes: [40, 41, 42],
      inStock: true,
    },
    {
      id: 3,
      name: "Adidas UltraBoost",
      description: "Кроссовки с отличной амортизацией для бега.",
      images: ["/img/adidas_ultraboost.webp", "/img/adidas_ultraboost2.jpg"],
      price: 550,
      sizes: [41, 42, 43],
      inStock: true,
    },
    {
      id: 4,
      name: "Puma RS-X",
      description: "Модные кроссовки Puma с хорошей поддержкой.",
      images: ["/img/puma_rsx.jpg", "/img/puma_rsx2.jpg"],
      price: 450,
      sizes: [40, 41, 42],
      inStock: true,
    },
  ],
};


export default function ProductPage() {
  const { id } = useParams();
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [showError, setShowError] = useState(false);
  const [cartStatus, setCartStatus] = useState<"default" | "pending" | "canceled" | "added">("default");
  const [activeIndex, setActiveIndex] = useState(0);
  const sizeRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [showBadgeText, setShowBadgeText] = useState(false);
  const [cancelTimer, setCancelTimer] = useState<NodeJS.Timeout | null>(null);

  const product = Object.values(productsData)
    .flat()
    .find((item) => item.id === Number(id));

  // Функция добавления в корзину с анимацией
  const handleAddToCart = () => {
    if (!selectedSize) {
      setShowError(true);
      return;
    }

    setCartStatus("pending");

    const timer = setTimeout(() => {
      setCartStatus("added");
      console.log("Товар добавлен в корзину:");
      console.log(`Название: ${product.name}`);
      console.log(`Цена: $${product.price}`);
      console.log(`Размер: ${selectedSize}`);
      setTimeout(() => setCartStatus("default"), 3000);
    }, 5000);

    setCancelTimer(timer);
  };

  // Функция отмены добавления
  const handleCancel = () => {
    if (cancelTimer) clearTimeout(cancelTimer);
    setCartStatus("canceled");

    setTimeout(() => setCartStatus("default"), 3000);
  };

  if (!product) {
    return (
      <Container className="py-20 text-center">
        <h2 className="text-3xl font-bold">Товар не найден</h2>
        <Link href="/" className="text-blue-600 underline mt-4 inline-block">
          Вернуться на главную
        </Link>
      </Container>
    );
  }

  const handleSizeSelect = (size: number) => {
    setSelectedSize(size);
    setShowError(false);
    setShowSizeChart(false);
    setTimeout(() => setShowSizeChart(true), 50);
  };

  // Обработчик для подбора образа
  const handleSuggestOutfit = async () => {
    try {
      const data = {
        top: "Красная футболка",
        bottom: "Синие джинсы",
        accessories: "Черные кроссовки",
      };

      console.log("Подобранный образ:", data);
    } catch (error) {
      console.error("Ошибка подбора образа:", error);
    }
  };

  return (
    <Container className="py-10">
      <div className="grid grid-cols-2 gap-10 items-start relative">
        {/* Левая часть: Слайдер */}
        <div className="relative w-full h-screen overflow-hidden">
          <div
            className={`absolute top-4 left-4 flex items-center gap-2 p-2 rounded-lg bg-white shadow-lg z-10 cursor-pointer transition-all duration-500
              ${showBadgeText ? "w-auto" : "w-[40px] h-[40px] p-1"}`}
            onMouseEnter={() => setShowBadgeText(true)}
            onMouseLeave={() => setShowBadgeText(false)}
          >
            <Image src="/img/звездочкиии.png" alt="Оригинальный товар" width={30} height={30} />
            <span className={`transition-all duration-500 ${showBadgeText ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
              Все товары в StageStore строго оригинальные.
            </span>
          </div>

          <Swiper
    direction="vertical"
    mousewheel={{ forceToAxis: true }}
    modules={[Mousewheel]}
    className="w-full h-full"
    onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
  >
    {product.images.map((image, index) => (
      <SwiperSlide key={index} className="relative">
        <Image
          src={image}
          alt={product.name}
          fill
          className="object-cover"
        />
      </SwiperSlide>
    ))}
  </Swiper>

          <div className="absolute right-8 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-10">
            {product.images.map((_, dotIndex) => (
              <span
                key={dotIndex}
                className={`w-2.5 h-2.5 rounded-full transition ${
                  activeIndex === dotIndex ? "bg-white" : "bg-gray-400 opacity-50"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Правая часть */}
        <div className="sticky top-20">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-2xl text-gray-600 mt-2">${product.price}</p>

          <div className="mt-6 p-4 border rounded bg-gray-50">
            <h3 className="text-lg font-semibold">Описание</h3>
            <p className="text-gray-700 mt-2">{product.description}</p>
          </div>

          <div className="relative w-fit mx-auto mt-2">
            <div className="relative flex bg-gray-100 p-3 rounded-full">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  ref={(el) => (sizeRefs.current[size] = el)}
                  onClick={() => handleSizeSelect(size)}
                  className={`relative px-6 py-2 text-sm font-semibold transition-all duration-300 z-10 ${
                    selectedSize === size ? "text-white" : "text-black"
                  }`}
                >
                  {size}
                </button>
              ))}
              {selectedSize && (
                <div
                  className="absolute top-1/2 left-0 w-[42px] h-[30px] bg-black rounded-full transition-all duration-300 ease-in-out transform -translate-y-1/2"
                  style={{
                    transform: `translateX(${sizeRefs.current[selectedSize]?.offsetLeft + sizeRefs.current[selectedSize]?.offsetWidth / 2 - 21}px) translateY(-50%)`,
                  }}
                />
              )}
            </div>
          </div>

          {showError && (
            <p className="mt-2 text-red-600 text-sm animate-fadeIn">
              ⚠ Выберите, пожалуйста, размер
            </p>
          )}

          <AnimatePresence mode="wait">
            {selectedSize && (
              <motion.div
                key={selectedSize}
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="mt-4 p-4 border rounded bg-gray-50 shadow-md"
              >
                <h3 className="text-lg font-semibold">Таблица размеров</h3>
                <p>🇪🇺 EU: <span className="font-bold">{selectedSize}</span></p>
                <p>🇺🇸 US: <span className="font-bold">{sizeChart[selectedSize].us}</span></p>
                <p>📏 CM: <span className="font-bold">{sizeChart[selectedSize].cm} см</span></p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Блок кнопок */}
<div className="mt-6 flex gap-4">
  <Button className="flex-grow" onClick={handleSuggestOutfit}>
    С чем сочетать?
  </Button>
  <button
    className={`relative flex-grow px-6 py-3 font-semibold rounded-lg transition-all duration-300 overflow-hidden ${
      cartStatus === "pending" ? "bg-gray-400 text-white" :
      cartStatus === "added" ? "bg-gray-500 text-white" :
      cartStatus === "canceled" ? "bg-gray-300 text-black" :
      "bg-black text-white"
    }`}
    onClick={cartStatus === "pending" ? handleCancel : handleAddToCart}
  >
    <span className="relative z-10">
      {cartStatus === "pending" ? "Отменить" :
      cartStatus === "canceled" ? "Отменено ❌" :
      cartStatus === "added" ? "Добавлено ✅" :
      `Добавить в корзину – $${product.price}`}
    </span>

    {cartStatus === "pending" && (
      <motion.span
        className="absolute left-0 top-0 h-full bg-gray-500/30"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 5, ease: "linear" }}
      />
    )}
  </button>
</div>

{/* Блок с похожими товарами */}
<div className="mt-12 w-full flex justify-center">
  <div className="w-full max-w-[900px]">
    <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">
      Похожие модели
    </h2>
    <div className="relative overflow-hidden">
      <Swiper
        slidesPerView={3}
        spaceBetween={20}
        loop={true}
        className="flex"
      >
        {productsData.footwear.slice(0, 10).map((similarProduct) => (
          <SwiperSlide key={similarProduct.id} className="transition-opacity duration-500">
            <div className="border border-gray-300 rounded-lg shadow-sm bg-gray-50 p-3 text-center flex flex-col items-center h-[260px]">
              <Image
                src={similarProduct.images[0]}
                alt={similarProduct.name}
                width={200}
                height={200}
                className="mx-auto object-contain h-[150px]"
              />
              <h3 className="font-bold text-gray-700 mt-2">{similarProduct.name}</h3>
              <p className="text-gray-500 mt-2">${similarProduct.price}</p>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
        </div>
      </div>
    </div>
  </div>
</div>
</Container>
  );
}
