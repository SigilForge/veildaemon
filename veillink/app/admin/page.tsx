import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Admin",
  description: "VeilLink admin console.",
  path: "/admin",
  noIndex: true,
});

export default async function AdminPage() {
  await requireAdmin().catch(() => redirect("/dashboard"));
  const admin = getSupabaseAdminClient();
  const [users, redirects, scans, recentReports, subscriberCount, subscribers] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("redirects").select("id", { count: "exact", head: true }),
    admin.from("scan_events").select("id", { count: "exact", head: true }),
    admin.from("abuse_reports").select("id,reason,details,status,created_at,redirect_id").order("created_at", { ascending: false }).limit(10),
    admin
      .from("email_list_subscriptions")
      .select("id", { count: "exact", head: true })
      .is("unsubscribed_at", null),
    admin
      .from("email_list_subscriptions")
      .select("id,email,source,opted_in_at,unsubscribed_at")
      .is("unsubscribed_at", null)
      .order("opted_in_at", { ascending: false })
      .limit(25),
  ]);
  const { data: redirectRows } = await admin.from("redirects").select("id,name,slug,destination_url,active,suspended_at,suspension_reason").order("created_at", { ascending: false }).limit(25);
  return (
    <main className="page">
      <h1 className="page-title">Admin</h1>
      <section className="grid">
        <div className="panel"><strong>{users.count || 0}</strong><p className="muted">Users</p></div>
        <div className="panel"><strong>{redirects.count || 0}</strong><p className="muted">Redirects</p></div>
        <div className="panel"><strong>{scans.count || 0}</strong><p className="muted">Scans</p></div>
        <div className="panel"><strong>{subscriberCount.error ? "—" : subscriberCount.count || 0}</strong><p className="muted">Email list</p></div>
      </section>
      <section className="panel">
        <h2>Email list</h2>
        {subscribers.error ? (
          <p className="muted">Email list storage is not available yet. Apply the email list migration, then reload.</p>
        ) : (subscribers.data || []).length === 0 ? (
          <p className="muted">No one has opted in.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Email</th><th>Source</th><th>Opted in</th></tr></thead>
            <tbody>{(subscribers.data || []).map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>{row.source}</td>
                <td>{new Date(row.opted_in_at).toISOString().slice(0, 10)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <section className="panel">
        <h2>Redirects</h2>
        <table className="table">
          <thead><tr><th>Name</th><th>Destination</th><th>Status</th><th>Admin action</th></tr></thead>
          <tbody>{(redirectRows || []).map((item) => (
            <tr key={item.id}>
              <td>{item.name}<br /><span className="muted">{item.slug}</span></td>
              <td>{item.destination_url}</td>
              <td>{item.suspended_at ? `Suspended: ${item.suspension_reason || ""}` : item.active ? "Active" : "Paused"}</td>
              <td>
                <form action={`/api/admin/redirects/${item.id}/suspend`} method="post" className="toolbar">
                  <input name="reason" placeholder="Suspension reason" required />
                  <button className="danger" type="submit">Suspend</button>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Recent reports</h2>
        {(recentReports.data || []).map((report) => <p key={report.id}><strong>{report.reason}</strong> <span className="muted">{report.details}</span></p>)}
      </section>
    </main>
  );
}
