import { Cormorant_Garamond, JetBrains_Mono, Nunito, Oswald } from "next/font/google";
import type { FloatItem } from "./FloatingBottles";

// Шрифты акции (из референса): заголовки Oswald, бренды курсивом Cormorant, текст Nunito, подписи JetBrains Mono.
export const fontDisplay = Oswald({ subsets: ["latin", "cyrillic"], weight: ["300", "400"], display: "swap" });
export const fontSerif = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500"],
  style: ["italic"],
  display: "swap",
});
export const fontBody = Nunito({ subsets: ["latin", "cyrillic"], weight: ["400", "700"], display: "swap" });
export const fontMono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], weight: ["500"], display: "swap" });

export const BEAUTY_COLORS = {
  cream: "#FBF3EE",
  blush: "#F6DCD8",
  petal: "#EFB9BF",
  line: "#D9B7B4",
  ink: "#231A1B",
  inkMuted: "#6B5A5C",
  text: "#3A2D2F",
  accent: "#A3274F",
} as const;

const IMG = "/promo/beauty-week";

/** Флаконы вокруг арки на странице акции. Позиции — в % от блока с фото. */
export const HERO_BOTTLES: FloatItem[] = [
  { src: `${IMG}/glow-oil-berry.webp`, left: -10, top: 6, width: 17, depth: 0.85, rotate: -14, z: 3 },
  { src: `${IMG}/glow-oil-orange.webp`, left: 84, top: 4, width: 13, depth: 0.45, rotate: 12, z: 3 },
  { src: `${IMG}/glow-palette.webp`, left: 72, top: 58, width: 34, depth: 1, rotate: 8, z: 4 },
  { src: `${IMG}/glow-oil-coral.webp`, left: 2, top: 66, width: 15, depth: 0.7, rotate: 10, z: 4 },
  { src: `${IMG}/lip-max-pink.webp`, left: 90, top: 30, width: 8, depth: 0.3, rotate: -8, z: 0 },
  { src: `${IMG}/glow-oil-cherry.webp`, left: 24, top: 86, width: 12, depth: 0.95, rotate: -6, z: 4 },
  { src: `${IMG}/glow-oil-pink.webp`, left: -6, top: 40, width: 10, depth: 0.25, rotate: 6, z: 0 },
];

/** Флаконы вокруг арки, когда в акции и Dior, и Gucci: косметика и ароматы обоих брендов вперемешку. */
export const HERO_BOTTLES_MIX: FloatItem[] = [
  { src: `${IMG}/gucci-flora-jasmine.webp`, left: 88, top: 30, width: 11, depth: 0.3, rotate: 8, z: 0 },
  { src: `${IMG}/glow-oil-pink.webp`, left: -7, top: 44, width: 10, depth: 0.25, rotate: 6, z: 0 },
  { src: `${IMG}/glow-oil-berry.webp`, left: -11, top: 4, width: 15, depth: 0.85, rotate: -14, z: 3 },
  { src: `${IMG}/gucci-flora-orchid.webp`, left: 79, top: -3, width: 17, depth: 0.55, rotate: 11, z: 3 },
  { src: `${IMG}/glow-palette.webp`, left: 68, top: 60, width: 30, depth: 1, rotate: 8, z: 4 },
  { src: `${IMG}/gucci-lipstick-rosso.webp`, left: 3, top: 60, width: 9, depth: 0.75, rotate: 14, z: 4 },
  { src: `${IMG}/gucci-blush-poppy.webp`, left: 17, top: 82, width: 27, depth: 0.95, rotate: -7, z: 4 },
  { src: `${IMG}/gucci-flora-gardenia.webp`, left: 49, top: 80, width: 12, depth: 0.6, rotate: 5, z: 4 },
];
