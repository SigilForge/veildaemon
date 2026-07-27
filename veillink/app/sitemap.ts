import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { exampleRightsRecords } from "@/lib/rights/records";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.95, changeFrequency: "weekly" },
    { path: "/rights", priority: 0.8, changeFrequency: "weekly" },
    { path: "/signup", priority: 0.9, changeFrequency: "monthly" },
    { path: "/login", priority: 0.55, changeFrequency: "monthly" },
    { path: "/report", priority: 0.5, changeFrequency: "yearly" },
    { path: "/reset", priority: 0.3, changeFrequency: "yearly" },
  ];

  const rightsEntries = exampleRightsRecords.map((record) => ({
    path: `/rights/${record.slug}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
  }));

  return [...entries, ...rightsEntries].map((entry) => ({
    url: absoluteUrl(entry.path),
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
