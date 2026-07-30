import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RightsCreateForm } from "@/components/RightsCreateForm";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";
import { RIGHTS_DISCLAIMER, availabilityCategories, categoryValues, permissionValues, workTypes } from "@/lib/rights/schema";

export const metadata: Metadata = buildMetadata({
  title: "Preserve a Creator Rights Record",
  description: "Sign in to preserve and publish a durable Creator Rights Registry record with version history, QR verification, dossier export, AI permissions, and optional SHA-256 fingerprint metadata.",
  path: "/rights/create",
  image: "https://veildaemon.app/assets/social/creator-rights-record-og.webp",
  imageAlt: "Creator Rights Record verification card from SigilForge Studios",
  imageWidth: 1200,
  imageHeight: 675,
  keywords: [
    "AI training permissions",
    "creator rights registry",
    "copyright metadata",
    "digital rights declaration",
    "machine-readable AI permissions",
    "permanent publication record",
    "public licensing record",
  ],
  noIndex: true,
});

function optionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
}

function options(values: readonly string[]) {
  return values.map((value) => ({ value, label: optionLabel(value) }));
}

export default async function CreateRightsRecordPage() {
  const { user } = await requireUser().catch(() => redirect("/login?next=/rights/create"));

  return (
    <main className="page">
      <p className="eyebrow">Creator Rights Registry</p>
      <h1 className="page-title">Preserve a Creator Rights Record</h1>
      <p className="lede">
        This authenticated Registry flow creates the durable record: permanent URL, Registry ID, version history, QR
        verification, Creator Dossier export, and long-term provenance management. If you are still deciding what to do,
        the public Advisor remains available without signing in.
      </p>
      <div className="dashboard-actions">
        <Link className="button secondary" href="/rights/advisor">
          Open public Advisor
        </Link>
      </div>
      <p className="notice">{RIGHTS_DISCLAIMER}</p>

      <RightsCreateForm
        mode="registry"
        email={user.email || ""}
        workTypes={options(workTypes)}
        categories={options(categoryValues)}
        availabilityCategories={options(availabilityCategories)}
        permissionValues={options(permissionValues)}
        disclaimer={RIGHTS_DISCLAIMER}
      />
    </main>
  );
}
