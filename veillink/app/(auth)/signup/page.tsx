import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";
import { signUp } from "../actions";

export const metadata: Metadata = buildMetadata({
  title: "Start Free — Create Dynamic QR Codes",
  description:
    "Create a free VeilLink account for editable short links and dynamic QR codes. Three active redirects included. Print once, change destinations later.",
  path: "/signup",
  keywords: [
    "free dynamic QR code account",
    "create short link free",
    "sign up editable QR",
    "free QR code generator business",
  ],
});

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  return <AuthForm title="Start free" action={signUp} submit="Create account" error={params.error} signup next={params.next} />;
}
