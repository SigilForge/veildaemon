import { redirect } from "next/navigation";

export default async function LocalRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/api/resolve/${encodeURIComponent(slug)}?mode=path`);
}
