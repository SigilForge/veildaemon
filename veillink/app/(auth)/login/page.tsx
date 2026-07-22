import { AuthForm } from "@/components/AuthForm";
import { login } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthForm title="Log in" action={login} submit="Log in" error={params.error} />;
}
