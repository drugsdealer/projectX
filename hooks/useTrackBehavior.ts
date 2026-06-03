"use client";
/**
 * useTrackBehavior
 * Drop-in hook for automatic behavior tracking.
 * Call once per product/brand/category page.
 */

import { useEffect, useRef, useCallback } from "react";
import {
  trackProductView,
  trackBrandClick,
  trackCategoryVisit,
  trackSearch,
  markAddedToCart,
  markFavorited,
  type TrackProductViewInput,
} from "@/lib/user-behavior";
import { canUseOptionalClientData } from "@/lib/privacy-consent";

// ─── Product page dwell tracker ───────────────────────────────────────────────

interface UseTrackProductOptions {
  product: TrackProductViewInput | null;
  enabled?: boolean;
}

/**
 * Tracks product views + dwell time.
 * Call on the product detail page.
 * Sends one trackProductView() call when component unmounts (or visibility changes).
 */
export function useTrackProduct({ product, enabled = true }: UseTrackProductOptions) {
  const startRef = useRef<number>(Date.now());
  const dwellRef = useRef<number>(0);
  const flushedRef = useRef(false);

  const flush = useCallback(() => {
    if (!product || flushedRef.current || !enabled) return;
    if (!canUseOptionalClientData()) return;
    flushedRef.current = true;
    const dwell = dwellRef.current + (Date.now() - startRef.current);
    trackProductView({ ...product, dwellMs: dwell });
  }, [product, enabled]);

  // Track visibility (pause dwell when tab hidden)
  useEffect(() => {
    if (!product || !enabled) return;
    startRef.current = Date.now();
    dwellRef.current = 0;
    flushedRef.current = false;

    const onVisibility = () => {
      if (document.hidden) {
        dwellRef.current += Date.now() - startRef.current;
      } else {
        startRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.productId]);

  return { flush };
}

// ─── Brand click tracker ──────────────────────────────────────────────────────

export function useTrackBrandClick() {
  return useCallback(
    (brandId: number, brandName: string, brandSlug: string, brandLogo?: string | null) => {
      if (!canUseOptionalClientData()) return;
      trackBrandClick(brandId, brandName, brandSlug, brandLogo);
    },
    []
  );
}

// ─── Category visit tracker ───────────────────────────────────────────────────

export function useTrackCategoryVisit(slug: string | null | undefined, name: string | null | undefined) {
  useEffect(() => {
    if (!slug || !name) return;
    if (!canUseOptionalClientData()) return;
    trackCategoryVisit(slug, name);
  }, [slug, name]);
}

// ─── Search tracker ───────────────────────────────────────────────────────────

export function useTrackSearch() {
  return useCallback((query: string) => {
    if (!canUseOptionalClientData()) return;
    trackSearch(query);
  }, []);
}

// ─── Cart / favorite event passthrough ───────────────────────────────────────

export function useTrackCartFavorite() {
  const onAddedToCart = useCallback((productId: number) => {
    if (!canUseOptionalClientData()) return;
    markAddedToCart(productId);
  }, []);

  const onFavorited = useCallback((productId: number, value: boolean) => {
    if (!canUseOptionalClientData()) return;
    markFavorited(productId, value);
  }, []);

  return { onAddedToCart, onFavorited };
}
