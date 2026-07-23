import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/DashboardClient";
import { analyticsForUser } from "@/lib/analytics-store";
import { buildMetadata } from "@/lib/seo";
import { getUsage, listUserRedirects, requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Dashboard",
  description: "Manage VeilLink short links, download QR codes, and review scan counts.",
  path: "/dashboard",
  noIndex: true,
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ verified?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await requireUser().catch(() => redirect("/login"));
  const [redirects, usage, analytics] = await Promise.all([
    listUserRedirects(user.id),
    getUsage(user.id, profile.plan),
    analyticsForUser(user.id),
  ]);
  return (
    <main className="page">
      <h1 className="page-title">Dashboard</h1>
      <p className="lede">Create editable links, download QR codes, and watch the boring useful numbers move.</p>
      {params?.verified === "1" ? (
        <p className="success" style={{ marginBottom: "1.5rem" }} role="status">
          ✓ Email address confirmed successfully. Welcome to VeilLink!
        </p>
      ) : null}
      <DashboardClient initialRedirects={redirects} usage={usage} analytics={analytics} />
    </main>
  );
}
