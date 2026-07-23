"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { product } from "@/lib/config";

function field(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

function safeNextPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function signUp(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const email = field(formData, "email");
  const password = field(formData, "password");
  const next = safeNextPath(field(formData, "next"));
  const accepted = formData.get("terms") === "on";
  if (!accepted) redirect(`/signup?error=terms&next=${encodeURIComponent(next)}`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${product.appUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  if (!data.session) {
    redirect(`/login?sent=1&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function login(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const next = safeNextPath(field(formData, "next"));
  const { error } = await supabase.auth.signInWithPassword({
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function logout() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function resetPassword(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(field(formData, "email"), {
    redirectTo: `${product.appUrl}/update-password`,
  });
  if (error) redirect(`/reset?error=${encodeURIComponent(error.message)}`);
  redirect("/reset?sent=1");
}

export async function updatePassword(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: field(formData, "password") });
  if (error) redirect(`/update-password?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}
