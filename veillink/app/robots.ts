import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/signup", "/login", "/report", "/reset"],
        disallow: [
          "/dashboard",
          "/billing",
          "/account",
          "/admin",
          "/update-password",
          "/api/",
          "/r/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
