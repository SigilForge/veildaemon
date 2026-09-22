import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";
import { signUp } from "../actions";

export const metadata: Metadata = buildMetadata({
  title: "Start Free",
  description:
    "Create a free SigilForge account: connected play, Book One, Creator Rights, and QR & Links, all on one identity.",
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
