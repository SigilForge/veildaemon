import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import { product } from "@/lib/config";
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

export const metadata: Metadata = {
  title: {
    default: `${product.name} · Editable QR codes`,
    template: `%s · ${product.name}`,
  },
  description:
    "Print once. Change the destination anytime. Branded short links and dynamic QR codes without fake metrics or ransom-note pricing.",
  metadataBase: new URL(product.appUrl),
  openGraph: {
    title: `${product.name} · Editable QR codes`,
    description: "Print once. Change the destination forever. Honest short links and dynamic QR codes.",
    url: product.appUrl,
    siteName: product.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${product.name} · Editable QR codes`,
    description: "Print once. Change the destination forever. Honest short links and dynamic QR codes.",
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
              <span className="brand-mark">{product.name}</span>
              <span className="brand-sub">go.veildaemon.app</span>
            </Link>
            <nav className="nav-links" aria-label="Primary">
              <Link href="/pricing">Pricing</Link>
              {email ? (
                <>
                  <Link href="/dashboard">Dashboard</Link>
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
