import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TableHubClient } from "@/components/TableHubClient";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Table Live-Link",
  description:
    "VeilLink Table Live-Link connects Operators and a Handler across devices without background polling. Deliberate sync only: Send to Cell, End Pressure Round, Sync Cell, Archive Session.",
  path: "/table",
  noIndex: true,
});

export default async function TablePage() {
  await requireUser().catch(() => redirect("/login?next=/table"));
  return (
    <main className="page table-page">
      <p className="eyebrow">VeilLink · multi-device connection</p>
      <h1 className="page-title">Table Live-Link</h1>
      <p className="lede">
        VeilLink Table Live-Link connects Operators and a Handler across devices without background polling or continuous
        state transfer. Each participant edits locally; selected state moves only when someone deliberately uses Send to
        Cell, End Pressure Round, Sync Cell, or Archive Session.
      </p>
      <TableHubClient />
    </main>
  );
}
