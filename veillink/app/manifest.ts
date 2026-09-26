import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — Editable QR codes`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#07090a",
    theme_color: "#07090a",
    lang: "en",
    categories: ["business", "utilities", "productivity"],
    icons: [
      {
        src: "/brand/apple-touch-icon.png?v=20260924-sigilforge1",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon-512.png?v=20260924-sigilforge1",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/favicon-32x32.png?v=20260924-sigilforge1",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  };
}
