import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";
import { resetPassword } from "../actions";

export const metadata: Metadata = buildMetadata({
  title: "Reset password",
  description: "Request a VeilLink password reset email if you already have an account.",
  path: "/reset",
  noIndex: true,
});

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <AuthForm title="Reset password" action={resetPassword} submit="Send reset link" error={params.error} reset />
  );
}
