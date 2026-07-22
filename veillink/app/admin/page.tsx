import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/store";

export default async function AdminPage() {
  await requireAdmin().catch(() => redirect("/dashboard"));
  const admin = getSupabaseAdminClient();
  const [users, redirects, scans, recentReports] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("redirects").select("id", { count: "exact", head: true }),
    admin.from("scan_events").select("id", { count: "exact", head: true }),
    admin.from("abuse_reports").select("id,reason,details,status,created_at,redirect_id").order("created_at", { ascending: false }).limit(10),
  ]);
  const { data: redirectRows } = await admin.from("redirects").select("id,name,slug,destination_url,active,suspended_at,suspension_reason").order("created_at", { ascending: false }).limit(25);
  return (
    <main className="page">
      <h1 className="page-title">Admin</h1>
      <section className="grid">
        <div className="panel"><strong>{users.count || 0}</strong><p className="muted">Users</p></div>
        <div className="panel"><strong>{redirects.count || 0}</strong><p className="muted">Redirects</p></div>
        <div className="panel"><strong>{scans.count || 0}</strong><p className="muted">Scans</p></div>
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
