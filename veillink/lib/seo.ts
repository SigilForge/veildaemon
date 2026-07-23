import type { Metadata } from "next";
import { product } from "@/lib/config";

/** Prefer production app host for absolute URLs when env is localhost. */
export function siteOrigin() {
  const raw = (product.appUrl || "https://app.veildaemon.app").replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/i.test(raw)) return "https://app.veildaemon.app";
  return raw;
}

export const siteConfig = {
  name: product.name,
  shortName: product.name,
  tagline: "Editable QR codes without the ransom note",
  description:
    "Create dynamic QR codes and short links that keep working when your destination changes. Print once, update later. PNG/SVG downloads, scan counts, pause controls, and honest pricing from Cradlepoint Studio.",
  keywords: [
    "dynamic QR code",
    "editable QR code",
    "change QR code destination",
    "short link generator",
    "custom short URL",
    "QR code for business",
    "printable QR code",
    "QR code PNG SVG",
    "QR code scan analytics",
    "QR code expiration",
    "dynamic redirect QR",
    "menu QR code",
    "flyer QR code",
    "local business QR code",
    "VeilLink",
    "go.veildaemon.app",
    "Cradlepoint Studio",
  ],
  pathHost: product.pathHost,
  baseDomain: product.baseDomain,
  studioUrl: "https://veildaemon.app/studio/",
  twitterHandle: undefined as string | undefined,
};

export function absoluteUrl(path = "/") {
  const origin = siteOrigin();
  if (!path || path === "/") return origin;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

type BuildMetaInput = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  noIndex?: boolean;
  type?: "website" | "article";
  imageAlt?: string;
  /** Absolute path on this app (e.g. /brand/book-one-og.webp) or full URL. */
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
};

export function buildMetadata({
  title,
  description,
  path = "/",
  keywords = [],
  noIndex = false,
  type = "website",
  imageAlt,
  image,
  imageWidth = 1200,
  imageHeight = 630,
}: BuildMetaInput): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = title.includes(siteConfig.name) ? title : `${title} · ${siteConfig.name}`;
  const keywordList = [...new Set([...siteConfig.keywords, ...keywords])];
  const ogImage = image
    ? image.startsWith("http")
      ? image
      : absoluteUrl(image)
    : absoluteUrl("/og.png");

  return {
    title,
    description,
    keywords: keywordList,
    applicationName: siteConfig.name,
    authors: [{ name: "Cradlepoint Studio", url: siteConfig.studioUrl }],
    creator: "Cradlepoint Studio",
    publisher: "Cradlepoint Studio",
    category: "technology",
    alternates: {
      canonical: url,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      type,
      locale: "en_US",
      url,
      siteName: siteConfig.name,
      title: fullTitle,
      description,
      images: [
        {
          url: ogImage,
          width: imageWidth,
          height: imageHeight,
          alt: imageAlt || `${siteConfig.name} — ${siteConfig.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
    other: {
      "theme-color": "#07090a",
    },
  };
}

export function websiteJsonLd() {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: siteConfig.name,
        description: siteConfig.description,
        publisher: { "@id": `${origin}/#organization` },
        inLanguage: "en-US",
        potentialAction: {
          "@type": "RegisterAction",
          target: absoluteUrl("/signup"),
          name: "Create a free VeilLink account",
        },
      },
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "Cradlepoint Studio",
        url: siteConfig.studioUrl,
        brand: {
          "@type": "Brand",
          name: siteConfig.name,
        },
        makesOffer: {
          "@type": "Offer",
          itemOffered: { "@id": `${origin}/#software` },
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#software`,
        name: siteConfig.name,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "URL shortener and dynamic QR code manager",
        operatingSystem: "Web",
        url: origin,
        description: siteConfig.description,
        offers: [
          {
            "@type": "Offer",
            name: "Free",
            price: "0",
            priceCurrency: "USD",
            description: "3 active dynamic redirects with editable destinations",
            url: absoluteUrl("/pricing"),
          },
          {
            "@type": "Offer",
            name: "Pro",
            price: "7",
            priceCurrency: "USD",
            description: "100 active redirects, analytics dashboard, expiration dates",
            url: absoluteUrl("/pricing"),
          },
          {
            "@type": "Offer",
            name: "Business",
            price: "19",
            priceCurrency: "USD",
            description: "1,000 active redirects for multi-location and campaign use",
            url: absoluteUrl("/pricing"),
          },
        ],
        featureList: [
          "Dynamic QR codes with stable printed targets",
          "Editable short links on go.veildaemon.app",
          "PNG and SVG QR downloads",
          "Scan counts and pause controls",
          "Optional link expiration",
          "Path and subdomain routing",
        ],
        provider: { "@id": `${origin}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${origin}/#webpage`,
        url: origin,
        name: `${siteConfig.name} · Dynamic QR codes and short links`,
        isPartOf: { "@id": `${origin}/#website` },
        about: { "@id": `${origin}/#software` },
        description: siteConfig.description,
        inLanguage: "en-US",
      },
    ],
  };
}

export function pricingJsonLd() {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${siteConfig.name} dynamic QR and short links`,
    description: siteConfig.description,
    brand: { "@type": "Brand", name: siteConfig.name },
    url: absoluteUrl("/pricing"),
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "19",
      priceCurrency: "USD",
      offerCount: 3,
      offers: [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "USD",
          url: absoluteUrl("/pricing"),
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "7",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "7",
            priceCurrency: "USD",
            unitText: "MONTH",
          },
          url: absoluteUrl("/pricing"),
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Business",
          price: "19",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "19",
            priceCurrency: "USD",
            unitText: "MONTH",
          },
          url: absoluteUrl("/pricing"),
          availability: "https://schema.org/InStock",
        },
      ],
    },
    provider: {
      "@type": "Organization",
      name: "Cradlepoint Studio",
      url: siteConfig.studioUrl,
    },
    mainEntityOfPage: absoluteUrl("/pricing"),
    isRelatedTo: { "@id": `${origin}/#software` },
  };
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a dynamic QR code?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A dynamic QR code encodes a stable short URL you control. You can change the destination behind that URL without reprinting the QR file.",
        },
      },
      {
        "@type": "Question",
        name: "Do exported QR files keep working if I cancel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Exported static QR image files remain yours. Dynamic redirects depend on the VeilLink service remaining active.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a free plan?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Free includes three active redirects with editable destinations so you can prove the workflow before upgrading.",
        },
      },
      {
        "@type": "Question",
        name: "Where do VeilLink short URLs live?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Path links use ${siteConfig.pathHost}/your-slug. Subdomain links are available on paid plans when enabled.`,
        },
      },
    ],
  };
}
