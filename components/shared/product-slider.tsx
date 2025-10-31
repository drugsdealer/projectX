"use client";

import { useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel } from "swiper/modules";
import "swiper/css";
import "swiper/css/mousewheel";

interface ProductSliderProps {
  product: {
    images?: string[];
    name?: string;
  };
  /**
   * Необязательный список изображений для активного варианта (например, выбранного цвета).
   * Если передан, он имеет приоритет над product.images.
   */
  activeImages?: string[];
}

export const ProductSlider: React.FC<ProductSliderProps> = ({ product, activeImages }) => {
  const { images = [], name } = product;

  // Нормализуем список картинок: приоритет у activeImages (например, для выбранного цвета),
  // затем product.images, фильтруем пустые и дубли, и подставляем fallback при необходимости.
  const slides = useMemo(() => {
    const baseList = Array.isArray(activeImages) && activeImages.length
      ? activeImages
      : images;

    const filtered = (baseList ?? []).filter(
      (src): src is string => typeof src === "string" && src.trim().length > 0
    );

    const unique = Array.from(new Set(filtered));

    if (!unique.length) {
      return ["/img/fallback.jpg"];
    }

    return unique;
  }, [activeImages, images]);

  return (
    <Swiper
      direction="vertical"
      slidesPerView={1}
      spaceBetween={0}
      mousewheel={true}
      modules={[Mousewheel]}
      className="h-screen w-full"
    >
      {slides.map((image, index) => (
        <SwiperSlide key={image ?? index} className="flex justify-center items-center">
          <img
            src={image}
            alt={
              name
                ? `${name} — фото ${index + 1}`
                : `Фото товара ${index + 1}`
            }
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </SwiperSlide>
      ))}
    </Swiper>
  );
};
