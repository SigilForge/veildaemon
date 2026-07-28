import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Creator Rights Registry",
  description: "Search the public Creator Rights Registry for publication details, AI permissions, licensing terms, QR links, and JSON metadata.",
  path: "/rights",
  image: "https://veildaemon.app/assets/social/creator-rights-record-og.webp",
  imageAlt: "Creator Rights Record verification card from SigilForge Studios",
  imageWidth: 1200,
  imageHeight: 675,
  noIndex: true,
});

export default function RightsIndexPage() {
  permanentRedirect("https://veildaemon.app/registry/");
}
