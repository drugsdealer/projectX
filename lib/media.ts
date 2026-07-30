export function normalizeMediaUrl(url?: string | null) {
  return typeof url === "string" ? url.trim() : "";
}

function isSvgUrl(url?: string | null) {
  const src = normalizeMediaUrl(url).toLowerCase();
  return /\.svg(?:[?#]|$)/i.test(src) || src.startsWith("data:image/svg+xml");
}

export function isImageKitUrl(url?: string | null) {
  const src = normalizeMediaUrl(url);
  if (!src) return false;
  const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.replace(/\/+$/g, "");
  if (endpoint && src.startsWith(`${endpoint}/`)) return true;
  return /^https:\/\/(?:[^/]+\.)?imagekit\.io\//i.test(src) || /^https:\/\/ik\.imagekit\.io\//i.test(src);
}

export function shouldBypassNextImageOptimization(url?: string | null) {
  const src = normalizeMediaUrl(url);
  if (!/^https?:\/\//i.test(src)) return false;
  if (isSvgUrl(src)) return true;
  return !isImageKitUrl(src);
}

type ImageKitTransformOptions = {
  width?: number;
  height?: number;
  quality?: number | "auto";
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  dpr?: number | "auto";
  // crop strategy (напр. "maintain_ratio") и фокус ("auto" — умная обрезка по объекту)
  crop?: string;
  focus?: string;
};

function numberParam(value?: number) {
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.round(value as number));
}

export function imageKitTransform(options: ImageKitTransformOptions = {}) {
  const parts: string[] = [];
  const width = numberParam(options.width);
  const height = numberParam(options.height);
  if (width) parts.push(`w-${width}`);
  if (height) parts.push(`h-${height}`);
  if (options.crop) parts.push(`c-${options.crop}`);
  if (options.focus) parts.push(`fo-${options.focus}`);
  parts.push(`q-${options.quality ?? "auto"}`);
  parts.push(`f-${options.format ?? "auto"}`);
  if (options.dpr) parts.push(`dpr-${options.dpr}`);
  return parts.join(",");
}

export function getOptimizedImageUrl(url?: string | null, options: ImageKitTransformOptions = {}) {
  const src = normalizeMediaUrl(url);
  if (!src || !isImageKitUrl(src) || isSvgUrl(src)) return src;

  try {
    const parsed = new URL(src);
    parsed.searchParams.set("tr", imageKitTransform(options));
    return parsed.toString();
  } catch {
    return src;
  }
}

function isCloudinaryUrl(url?: string | null) {
  return /^https:\/\/res\.cloudinary\.com\//i.test(normalizeMediaUrl(url));
}

function cloudinaryTransform(url: string, width: number) {
  if (url.includes("/upload/w_")) return url;
  return url.replace("/upload/", `/upload/w_${width},q_auto,f_auto/`);
}

// Универсальная сжатая версия картинки сторис: ImageKit — через getOptimizedImageUrl,
// Cloudinary (старые сторис) — через нативный transform в URL, иначе — как есть.
export function getStoryImageUrl(url?: string | null, width = 480) {
  const src = normalizeMediaUrl(url);
  if (!src) return src;
  if (isImageKitUrl(src)) return getOptimizedImageUrl(src, { width, quality: "auto" });
  if (isCloudinaryUrl(src)) return cloudinaryTransform(src, width);
  return src;
}

export function isAllowedMediaUrl(url?: string | null) {
  const src = normalizeMediaUrl(url);
  if (!src) return false;
  if (src.startsWith("/")) return true;
  return isImageKitUrl(src);
}
