import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { product } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: `${product.name} - Editable QR codes`,
  description: "Branded, editable QR codes and short links without the ransom note.",
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
    <html lang="en">
      <body>
        <div className="shell">
          <header className="nav">
            <Link className="brand" href="/">{product.name}</Link>
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
                  <Link className="button" href="/signup">Start free</Link>
                </>
              )}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
