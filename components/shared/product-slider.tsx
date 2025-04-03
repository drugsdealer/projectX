"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel } from "swiper/modules";
import "swiper/css";
import "swiper/css/mousewheel";

interface ProductSliderProps {
  images: string[];
}

export const ProductSlider: React.FC<ProductSliderProps> = ({ images }) => {
  return (
    <Swiper
      direction="vertical"
      slidesPerView={1}
      spaceBetween={0}
      mousewheel={true}
      modules={[Mousewheel]}
      className="h-screen w-full"
    >
      {images.map((image, index) => (
        <SwiperSlide key={index} className="flex justify-center items-center">
          <img src={image} alt={`Product ${index}`} className="h-full object-cover" />
        </SwiperSlide>
      ))}
    </Swiper>
  );
};
