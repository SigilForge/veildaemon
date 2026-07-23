import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import { buildMetadata } from "@/lib/seo";
import { getUsage, listUserRedirects, requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Account",
  description: "VeilLink account settings, plan usage, and data export.",
  path: "/account",
  noIndex: true,
});

function toCsv(rows: Awaited<ReturnType<typeof listUserRedirects>>) {
  const header = ["id", "name", "slug", "routing_mode", "destination_url", "active", "total_scans", "created_at"];
  const body = rows.map((row) => header.map((key) => JSON.stringify(String(row[key as keyof typeof row] ?? ""))).join(","));
  return [header.join(","), ...body].join("\n");
}

export default async function AccountPage() {
  const { user, profile } = await requireUser().catch(() => redirect("/login"));
  const [redirects, usage] = await Promise.all([listUserRedirects(user.id), getUsage(user.id, profile.plan)]);
  const jsonExport = JSON.stringify(redirects, null, 2);
  const csvExport = toCsv(redirects);
  return (
    <main className="page">
      <h1 className="page-title">Account</h1>
      <section className="grid">
        <div className="panel">
          <h2>{user.email}</h2>
          <p className="muted">Plan: {profile.plan}</p>
          <p className="muted">Active redirects: {usage.activeRedirects} / {usage.limit}</p>
          <form action={logout}><button className="secondary" type="submit">Log out</button></form>
        </div>
        <div className="panel">
          <h2>Export</h2>
          <p className="muted">Your redirect data is available as JSON or CSV from this page.</p>
          <div className="toolbar">
            <a className="button secondary" download="veillink-redirects.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(jsonExport)}`}>JSON</a>
            <a className="button secondary" download="veillink-redirects.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvExport)}`}>CSV</a>
          </div>
        </div>
        <div className="panel">
          <h2>Delete account</h2>
          <p className="muted">Account deletion should remove the Supabase auth user, profile, redirects, scans, and audit-owned records through server-side admin tooling. The destructive endpoint is intentionally left as a documented follow-up until support policy is decided.</p>
        </div>
      </section>
    </main>
  );
}
