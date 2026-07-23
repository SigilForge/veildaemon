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
        Accounts, lobby code, sheet diffs, and deliberate sync buttons — not background machinery. Operators edit
        locally and Send to Cell; Handler ends a Pressure Round, Syncs the Cell, or Archives the session.
      </p>
      <TableHubClient />
    </main>
  );
}
