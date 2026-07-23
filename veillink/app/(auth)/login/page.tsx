import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";
import { login } from "../actions";

export const metadata: Metadata = buildMetadata({
  title: "Log in",
  description: "Log in to VeilLink to manage short links, download QR codes, view scan counts, and update destinations.",
  path: "/login",
  keywords: ["VeilLink login", "QR code dashboard login"],
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; sent?: string; verified?: string; email?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      title="Log in"
      action={login}
      submit="Log in"
      error={params.error}
      sent={Boolean(params.sent)}
      verified={Boolean(params.verified)}
      email={params.email}
      next={params.next}
    />
  );
}
