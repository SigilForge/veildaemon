import { RightsProductChrome } from "@/components/RightsProductChrome";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function isSignedIn() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

export default async function RightsProductLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await isSignedIn();

  return (
    <>
      <RightsProductChrome signedIn={signedIn} />
      {children}
    </>
  );
}
