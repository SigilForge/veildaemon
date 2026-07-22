import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/DashboardClient";
import { analyticsForUser } from "@/lib/analytics-store";
import { getUsage, listUserRedirects, requireUser } from "@/lib/store";

export default async function DashboardPage() {
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
      <DashboardClient initialRedirects={redirects} usage={usage} analytics={analytics} />
    </main>
  );
}
