import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";
import { updatePassword } from "../actions";

export const metadata: Metadata = buildMetadata({
  title: "Set new password",
  description: "Choose a new password for your VeilLink account.",
  path: "/update-password",
  noIndex: true,
});

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <AuthForm
      title="Set new password"
      action={updatePassword}
      submit="Update password"
      error={params.error}
      updatePassword
    />
  );
}
