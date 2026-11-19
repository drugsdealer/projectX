"use client";

/**
 * «Парящие» флаконы с параллаксом.
 *
 * Каждый флакон — отдельная PNG/WebP с прозрачным фоном на своей «глубине» (depth 0…1):
 * чем больше глубина, тем сильнее он смещается. Движение складывается из трёх частей:
 *  1) само по себе — медленное покачивание, даже если посетитель ничего не делает;
 *  2) за курсором (компьютер) или наклоном телефона (гироскоп, где браузер его отдаёт);
 *  3) от прокрутки страницы — ближние флаконы обгоняют дальние.
 * Анимация идёт через requestAnimationFrame и transform (без перерисовок React),
 * останавливается, когда блок не на экране, и почти выключается при «уменьшить движение».
 */
import { useEffect, useRef, type CSSProperties } from "react";

export type FloatItem = {
  src: string;
  alt?: string;
  /** Позиция и ширина в % от контейнера. */
  left: number;
  top: number;
  width: number;
  /** 0 — дальний план (почти неподвижен), 1 — ближний. */
  depth: number;
  rotate?: number;
  /** Ближние флаконы поверх фото, дальние — под ним. */
  z?: number;
};

type Props = {
  items: FloatItem[];
  /** Сила реакции на курсор/наклон и прокрутку. */
  intensity?: number;
  className?: string;
  style?: CSSProperties;
  /** Первые картинки страницы грузим сразу. */
  eager?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function FloatingBottles({ items, intensity = 1, className, style, eager }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let visible = true;
    let raf = 0;
    let lastInput = 0;
    const t0 = performance.now();

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      lastInput = performance.now();
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      target.x = (t.clientX / window.innerWidth) * 2 - 1;
      target.y = (t.clientY / window.innerHeight) * 2 - 1;
      lastInput = performance.now();
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      target.x = clamp(e.gamma / 25, -1, 1);
      target.y = clamp((e.beta - 45) / 25, -1, 1);
      lastInput = performance.now();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const t = (now - t0) / 1000;

      // Без ввода 4 секунды — курсорное смещение плавно возвращается в центр.
      if (now - lastInput > 4000) {
        target.x *= 0.98;
        target.y *= 0.98;
      }
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;

      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const scroll = clamp((rect.top + rect.height / 2 - vh / 2) / vh, -1.5, 1.5);

      for (let i = 0; i < items.length; i++) {
        const el = itemRefs.current[i];
        const it = items[i];
        if (!el || !it) continue;
        const d = clamp(it.depth, 0, 1);
        const k = reduce ? 0.15 : 1;
        const idleY = reduce ? 0 : Math.sin(t * (0.55 + 0.12 * (i % 3)) + i * 1.9) * (6 + 10 * d);
        const idleX = reduce ? 0 : Math.cos(t * (0.4 + 0.1 * (i % 2)) + i * 1.3) * (3 + 5 * d);
        const px = cur.x * (10 + 34 * d) * intensity * k;
        const py = cur.y * (8 + 26 * d) * intensity * k;
        const sy = scroll * (20 + 90 * d) * intensity * k;
        const rot = (it.rotate ?? 0) + (reduce ? 0 : Math.sin(t * 0.5 + i) * (1.5 + 2 * d)) + cur.x * 5 * d * k;
        el.style.transform = `translate3d(${(idleX + px).toFixed(2)}px, ${(idleY + py + sy).toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    io.observe(root);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("deviceorientation", onOrient, { passive: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [items, intensity]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style }}
    >
      {items.map((it, i) => (
        <div
          key={`${it.src}-${i}`}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          style={{
            position: "absolute",
            left: `${it.left}%`,
            top: `${it.top}%`,
            width: `${it.width}%`,
            zIndex: it.z ?? 1,
            willChange: "transform",
            transform: `rotate(${it.rotate ?? 0}deg)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- маленькие локальные webp с прозрачностью */}
          <img
            src={it.src}
            alt=""
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              userSelect: "none",
              filter: `drop-shadow(0 ${Math.round(10 + 16 * it.depth)}px ${Math.round(14 + 18 * it.depth)}px rgba(120,50,60,${(0.16 + 0.14 * it.depth).toFixed(2)}))`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
