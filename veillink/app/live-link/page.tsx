import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TableHubClient } from "@/components/TableHubClient";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "VeilLink Live-Link",
  description:
    "VeilLink Live-Link connects Operators and a Handler across devices without background polling. Deliberate sync only: Send to Cell, End Pressure Round, Sync Cell, Archive Operation.",
  path: "/live-link",
  noIndex: true,
});

export default async function TablePage() {
  await requireUser().catch(() => redirect("/login?next=/live-link"));
  return (
    <main className="page table-page">
      <p className="eyebrow">VeilLink · multi-device connection</p>
      <h1 className="page-title">Live-Link</h1>
      <p className="lede">
        VeilLink Live-Link connects Operators and a Handler across devices without background polling or continuous
        state transfer. Each participant edits locally; selected state moves only when someone deliberately uses Send to
        Cell, End Pressure Round, Sync Cell, or Archive Operation.
      </p>
      <TableHubClient />
    </main>
  );
}
