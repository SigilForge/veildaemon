import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RightsCreateForm } from "@/components/RightsCreateForm";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";
import { RIGHTS_DISCLAIMER, availabilityCategories, categoryValues, permissionValues, workTypes } from "@/lib/rights/schema";

export const metadata: Metadata = buildMetadata({
  title: "Register a Creator Rights Product",
  description: "Start from a file, source URL, or identifier, then review a provenance-aware Creator Rights draft with licensing, AI permissions, and optional SHA-256 fingerprint metadata.",
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
      <p className="eyebrow">Creator Rights Record</p>
      <h1 className="page-title">Register product</h1>
      <p className="lede">
        Start with a file, source URL, or identifier. The intake extracts what it can, labels uncertainty, keeps conflicts
        visible, and helps you choose a license through plain-language goals before you declare and publish.
      </p>
      <p className="notice">{RIGHTS_DISCLAIMER}</p>

      <RightsCreateForm
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
