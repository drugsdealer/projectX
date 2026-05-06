export function normalizeMediaUrl(url?: string | null) {
  return typeof url === "string" ? url.trim() : "";
}

export function isImageKitUrl(url?: string | null) {
  const src = normalizeMediaUrl(url);
  if (!src) return false;
  const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.replace(/\/+$/g, "");
  if (endpoint && src.startsWith(`${endpoint}/`)) return true;
  return /^https:\/\/(?:[^/]+\.)?imagekit\.io\//i.test(src) || /^https:\/\/ik\.imagekit\.io\//i.test(src);
}

export function isCloudinaryUrl(url?: string | null) {
  return /^https:\/\/res\.cloudinary\.com\//i.test(normalizeMediaUrl(url));
}

export function shouldBypassNextImageOptimization(url?: string | null) {
  return isImageKitUrl(url);
}

export function isAllowedMediaUrl(url?: string | null) {
  const src = normalizeMediaUrl(url);
  if (!src) return false;
  if (src.startsWith("/")) return true;
  return isImageKitUrl(src);
}
