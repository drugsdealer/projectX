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

export default nextConfig;
