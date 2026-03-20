import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stage Store",
    short_name: "Stage",
    description: "Брендовая одежда и аксессуары с гарантией подлинности",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
  };
}
