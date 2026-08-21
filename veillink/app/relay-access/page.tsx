import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { isRelayOperator } from "@/lib/policy";
import { getSupabaseServerClient } from "@/lib/supabase";
import { RelayAccessClient } from "./RelayAccessClient";

export const metadata: Metadata = buildMetadata({
  title: "RelayDaemon access",
  description: "Continue from VeilLink to the private RelayDaemon operator surface.",
  path: "/relay-access",
  noIndex: true,
});

export default async function RelayAccessPage() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/relay-access");
  const allowed = isRelayOperator(data.user.email, data.user);
  return <RelayAccessClient allowed={allowed} />;
}
