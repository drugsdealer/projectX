const imageKitEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "";
let imageKitHostname = "";

try {
  imageKitHostname = imageKitEndpoint ? new URL(imageKitEndpoint).hostname : "";
} catch {
  imageKitHostname = "";
}

const imageHosts = new Set(["ik.imagekit.io"]);
if (imageKitHostname) imageHosts.add(imageKitHostname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: Array.from(imageHosts).map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
};

export default nextConfig;
