import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TableSessionClient } from "@/components/TableSessionClient";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return buildMetadata({
    title: "Live session",
    description: "Handler ↔ Operator live state synchronization.",
    path: `/table/session/${id}`,
    noIndex: true,
  });
}

export default async function TableSessionPage({ params }: Props) {
  const { id } = await params;
  await requireUser().catch(() => redirect(`/login?next=/table/session/${id}`));
  return (
    <main className="page table-page">
      <TableSessionClient sessionId={id} />
    </main>
  );
}
