import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import { product } from "@/lib/config";
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
    default: `${siteConfig.name} · Dynamic QR Codes & Short Links`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  applicationName: siteConfig.name,
  authors: [{ name: "Cradlepoint Studio", url: siteConfig.studioUrl }],
  creator: "Cradlepoint Studio",
  publisher: "Cradlepoint Studio",
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
    title: `${siteConfig.name} · Dynamic QR Codes & Short Links`,
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
    title: `${siteConfig.name} · Dynamic QR Codes & Short Links`,
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
            <Link className="brand" href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="brand-emblem"
                src="/brand/cradlepoint-studio-emblem-256.webp"
                alt=""
                width={40}
                height={40}
              />
              <span className="brand-text">
                <span className="brand-mark">{product.name}</span>
                <span className="brand-sub">go.veildaemon.app</span>
              </span>
            </Link>
            <nav className="nav-links" aria-label="Primary">
              <Link href="/pricing">Pricing</Link>
              {email ? (
                <>
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/table">Table</Link>
                  <Link href="/billing">Billing</Link>
                  <Link href="/account">Account</Link>
                </>
              ) : (
                <>
                  <Link href="/login">Log in</Link>
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
                {product.name} is a Cradlepoint Studio utility for short links and editable QR codes. Printed QR files stay
                yours. Dynamic redirects depend on the service remaining active.
              </p>
              <nav className="footer-links" aria-label="Footer">
                <Link href="/pricing">Pricing</Link>
                <Link href="/report">Report abuse</Link>
                <a href="https://veildaemon.app/studio/" target="_blank" rel="noopener noreferrer">
                  Cradlepoint Studio
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
