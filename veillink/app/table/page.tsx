import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TableHubClient } from "@/components/TableHubClient";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Table Live-Link",
  description: "One Operator, one Handler, one session — live state for Cradlepoint table demos.",
  path: "/table",
  noIndex: true,
});

export default async function TablePage() {
  await requireUser().catch(() => redirect("/login?next=/table"));
  return (
    <main className="page table-page">
      <p className="eyebrow">Cradlepoint · demo vertical slice</p>
      <h1 className="page-title">Table live-link</h1>
      <p className="lede">
        Persistent Operator files on your account. Temporary Handler sessions. Explicit join. Live Harm, Stability,
        Lotus, Breach, Void, and unlocks — then clean reconcile on close. Up to six Operators per session.
      </p>
      <TableHubClient />
    </main>
  );
}
