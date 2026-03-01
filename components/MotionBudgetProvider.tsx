"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

export type MotionLevel = "full" | "balanced" | "reduced";

type MotionBudgetContextValue = {
  motionLevel: MotionLevel;
  reduceMotion: boolean;
  isMotionPaused: boolean;
};

const MotionBudgetContext = createContext<MotionBudgetContextValue>({
  motionLevel: "full",
  reduceMotion: false,
  isMotionPaused: false,
});

const levelRank: Record<MotionLevel, number> = {
  full: 0,
  balanced: 1,
  reduced: 2,
};

const maxMotionLevel = (a: MotionLevel, b: MotionLevel): MotionLevel =>
  levelRank[a] >= levelRank[b] ? a : b;

const detectBaseMotionLevel = (): MotionLevel => {
  if (typeof window === "undefined") return "full";
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
      };
    };
    const cores = Number(nav.hardwareConcurrency ?? 8);
    const memory = Number(nav.deviceMemory ?? 8);
    const saveData = Boolean(nav.connection?.saveData);
    const net = String(nav.connection?.effectiveType || "").toLowerCase();

    if (saveData || net.includes("2g")) return "reduced";
    if (cores <= 2 || memory <= 2) return "reduced";
    if (net.includes("3g") || cores <= 4 || memory <= 4) return "balanced";
    return "full";
  } catch {
    return "full";
  }
};

export default function MotionBudgetProvider({ children }: { children: ReactNode }) {
  const [motionLevel, setMotionLevel] = useState<MotionLevel>("full");
  const [isMotionPaused, setIsMotionPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compute = () => {
      const base = detectBaseMotionLevel();
      const next: MotionLevel = media.matches ? "reduced" : base;
      setMotionLevel(next);
    };

    compute();

    const onMediaChange = () => compute();
    if (media.addEventListener) media.addEventListener("change", onMediaChange);
    else media.addListener(onMediaChange);

    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    if (connection?.addEventListener) connection.addEventListener("change", compute);

    return () => {
      if (media.removeEventListener) media.removeEventListener("change", onMediaChange);
      else media.removeListener(onMediaChange);
      if (connection?.removeEventListener) connection.removeEventListener("change", compute);
    };
  }, []);

  // Runtime fallback: if real FPS проседает, понижаем уровень
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    let frameCount = 0;
    let start = performance.now();
    let cancelled = false;
    const maxSampleMs = 3200;
    const begin = performance.now();

    const sample = (now: number) => {
      frameCount += 1;
      const elapsed = now - start;
      if (elapsed >= 900) {
        const fps = (frameCount * 1000) / elapsed;
        setMotionLevel((prev) => {
          if (fps < 36) return maxMotionLevel(prev, "reduced");
          if (fps < 50) return maxMotionLevel(prev, "balanced");
          return prev;
        });
        frameCount = 0;
        start = now;
      }
      if (!cancelled && now - begin < maxSampleMs) raf = window.requestAnimationFrame(sample);
    };

    raf = window.requestAnimationFrame(sample);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => setIsMotionPaused(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-motion", motionLevel);
  }, [motionLevel]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-motion-paused", isMotionPaused ? "1" : "0");
  }, [isMotionPaused]);

  const reduceMotion = motionLevel === "reduced";
  const contextValue = useMemo(
    () => ({
      motionLevel,
      reduceMotion,
      isMotionPaused,
    }),
    [isMotionPaused, motionLevel, reduceMotion]
  );

  return (
    <MotionBudgetContext.Provider value={contextValue}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
        {children}
      </MotionConfig>
    </MotionBudgetContext.Provider>
  );
}

export const useMotionBudget = () => useContext(MotionBudgetContext);
