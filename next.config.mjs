import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const imageKitEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "";
let imageKitHostname = "";

try {
  imageKitHostname = imageKitEndpoint ? new URL(imageKitEndpoint).hostname : "";
} catch {
  imageKitHostname = "";
}

const imageHosts = new Set(["ik.imagekit.io", "**.imagekit.io"]);
if (imageKitHostname) imageHosts.add(imageKitHostname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [32, 48, 64, 96, 128, 160, 256, 384, 512, 768],
    remotePatterns: Array.from(imageHosts).map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
};

import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(nextConfig, {
  silent: true,
  // Загрузку source maps отключаем — не требует SENTRY_AUTH_TOKEN, сборка проходит без внешних зависимостей.
  sourcemaps: { disable: true },
  disableLogger: true,
});
