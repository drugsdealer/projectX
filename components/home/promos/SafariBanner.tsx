'use client';

import Link from "next/link";
import Image from "next/image";
import { shouldBypassNextImageOptimization, getOptimizedImageUrl } from "@/lib/media";

const SAFARI_IMAGE = "https://ik.imagekit.io/qowmy92ny/ChatGPT%20Image%2026%20%D0%BC%D0%B0%D1%8F%202026%20%D0%B3.,%2022_23_13.png";

const optimizedSrc = getOptimizedImageUrl(SAFARI_IMAGE, { width: 1600, quality: 85 });
const bypass = shouldBypassNextImageOptimization(SAFARI_IMAGE);

export default function SafariBanner() {
  return (
    <Link
      href="/collection/safari"
      className="group relative block w-full overflow-hidden rounded-2xl sm:rounded-3xl"
      style={{ aspectRatio: "16/7" }}
      aria-label="Зов саванны — подборка с анималистичными принтами"
    >
      {/* Photo */}
      <Image
        src={optimizedSrc}
        alt="Зов саванны — леопардовые и зебровые принты"
        fill
        sizes="(max-width: 768px) 100vw, 1200px"
        priority={false}
        className="object-cover transition duration-700 group-hover:scale-[1.03]"
        unoptimized={bypass}
      />

      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent pointer-events-none" />

      {/* Text overlay */}
      <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-6 sm:px-10 py-6">
        <p className="mb-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/65">
          Подборка Stage Store
        </p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-[-0.03em] text-white leading-none drop-shadow-md">
          Wild Terrain
        </h2>
        <p className="mt-2 text-sm text-white/80 max-w-[240px] sm:max-w-xs leading-snug">
          Анималистичные принты — леопард, зебра, корова.
        </p>

        {/* CTA chip */}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 px-4 py-1.5 text-xs font-bold text-white transition group-hover:bg-white/25 self-start">
          Смотреть подборку
          <span aria-hidden className="translate-x-0 group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
