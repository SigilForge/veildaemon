import { AuthForm } from "@/components/AuthForm";
import { updatePassword } from "../actions";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthForm title="Set new password" action={updatePassword} submit="Update password" error={params.error} updatePassword />;
}
