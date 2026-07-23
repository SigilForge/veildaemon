import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TableHubClient } from "@/components/TableHubClient";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Join table session",
  description: "Join a Handler session with your Operator file.",
  path: "/table/join",
  noIndex: true,
});

type Props = { searchParams: Promise<{ code?: string }> };

export default async function TableJoinPage({ searchParams }: Props) {
  const q = await searchParams;
  await requireUser().catch(() =>
    redirect(`/login?next=${encodeURIComponent(`/table/join?code=${q.code || ""}`)}`),
  );
  return (
    <main className="page table-page">
      <p className="eyebrow">Operator join</p>
      <h1 className="page-title">Join session {q.code ? `· ${q.code}` : ""}</h1>
      <p className="lede">Select your Operator file and enter the Handler join code. Access is temporary and revocable.</p>
      <TableHubClient initialJoinCode={q.code || ""} />
    </main>
  );
}
