import { AuthForm } from "@/components/AuthForm";
import { resetPassword } from "../actions";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const params = await searchParams;
  return (
    <>
      {params.sent ? <main className="page"><p className="panel">Password reset email sent if that account exists.</p></main> : null}
      <AuthForm title="Reset password" action={resetPassword} submit="Send reset link" error={params.error} reset />
    </>
  );
}
