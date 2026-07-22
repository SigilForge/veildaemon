import { AuthForm } from "@/components/AuthForm";
import { signUp } from "../actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthForm title="Start free" action={signUp} submit="Create account" error={params.error} signup />;
}
