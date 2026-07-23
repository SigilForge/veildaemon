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
  };
}
