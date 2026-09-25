import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import { ProductAccountLink } from "@/components/ProductAccountLink";
import { product } from "@/lib/config";
import {
  RIGHTS_PRODUCT_CREATE_LABEL,
  RIGHTS_PRODUCT_CREATE_PATH,
  RIGHTS_PRODUCT_REGISTRY_PATH,
} from "@/lib/rights/product-nav";
import { absoluteUrl, siteConfig, siteOrigin } from "@/lib/seo";
import { getSupabaseServerClient } from "@/lib/supabase";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07090a" },
    { media: "(prefers-color-scheme: light)", color: "#07090a" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: `${siteConfig.name} · SigilForge Studios`,
    template: `%s · ${siteConfig.name} · SigilForge Studios`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  applicationName: siteConfig.name,
  authors: [{ name: "SigilForge Studios", url: siteConfig.studioUrl }],
  creator: "SigilForge Studios",
  publisher: "SigilForge Studios",
  category: "technology",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
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
    type: "website",
    locale: "en_US",
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    title: `${siteConfig.name} · SigilForge Studios`,
    description: siteConfig.description,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — ${siteConfig.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} · SigilForge Studios`,
    description: siteConfig.description,
    images: ["/twitter-image.png"],
  },
  other: {
    "theme-color": "#07090a",
  },
};

async function sessionEmail() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "";
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email || "";
  } catch {
    return "";
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const email = await sessionEmail();
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="shell">
          <header className="nav">
            <Link className="brand" href={email ? "/home" : "/"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="brand-emblem"
                src="/brand/sigilforge-emblem-256.webp"
                alt=""
                width={40}
                height={40}
              />
              <span className="brand-text">
                <span className="brand-mark">SigilForge</span>
                <span className="brand-sub">{product.name}</span>
              </span>
            </Link>
            <nav className="nav-links" aria-label="Primary">
              <a href="https://veildaemon.app/studio/" target="_blank" rel="noopener noreferrer">
                Studio
              </a>
              <a href="https://veildaemon.app/" target="_blank" rel="noopener noreferrer">
                Play
              </a>
              <Link href="/pricing">Pricing</Link>
              <Link href={RIGHTS_PRODUCT_REGISTRY_PATH}>Creator Rights</Link>
              <span className="nav-divider" aria-hidden="true" />
              {email ? (
                <>
                  <Link href="/dashboard">QR &amp; Links</Link>
                  <Link href="/billing">Billing</Link>
                  {/* Original QR / short-link product: shared Account control → /account */}
                  <ProductAccountLink product="qr" signedIn className="button secondary" />
                </>
              ) : (
                <>
                  {/* Always expose Account on QR product chrome (login with return). */}
                  <ProductAccountLink product="qr" signedIn={false} />
                  <Link href="/">Log in</Link>
                  <Link className="button" href="/signup">
                    Start free
                  </Link>
                </>
              )}
            </nav>
          </header>
          <div id="main">{children}</div>
          <footer className="site-footer">
            <div className="footer-inner">
              <p className="footer-copy">
                {product.name} hosts dynamic QR links and Creator Rights records for SigilForge Studios. Printed QR
                files stay yours. Public rights records stay readable.
              </p>
              <nav className="footer-links" aria-label="Footer">
                <Link href="/pricing">Pricing</Link>
                <Link href={RIGHTS_PRODUCT_REGISTRY_PATH}>Creator Rights</Link>
                <Link href={RIGHTS_PRODUCT_CREATE_PATH}>{RIGHTS_PRODUCT_CREATE_LABEL}</Link>
                <Link href="/report">Report abuse</Link>
                <a href="https://veildaemon.app/studio/" target="_blank" rel="noopener noreferrer">
                  SigilForge Studios
                </a>
                <a href="https://veildaemon.app/" target="_blank" rel="noopener noreferrer">
                  VeilDaemon
                </a>
              </nav>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
