import type { Metadata } from "next";
import Link from "next/link";
import { RightsCreateForm } from "@/components/RightsCreateForm";
import { buildMetadata } from "@/lib/seo";
import { RIGHTS_DISCLAIMER, availabilityCategories, categoryValues, permissionValues, workTypes } from "@/lib/rights/schema";

export const metadata: Metadata = buildMetadata({
  title: "Creator Rights Advisor",
  description: "Use the free Creator Rights Advisor to import a source or file, extract draft evidence, compare license options, generate SHA-256 metadata, and prepare a reviewable Creator Rights draft without an account.",
  path: "/rights/advisor",
  image: "https://veildaemon.app/assets/social/creator-rights-record-og.webp",
  imageAlt: "Creator Rights Record verification card from SigilForge Studios",
  imageWidth: 1200,
  imageHeight: 675,
  keywords: [
    "license advisor for creators",
    "AI permissions guidance",
    "creator rights advisor",
    "copyright metadata checker",
    "SHA-256 file fingerprint",
    "SPDX license recommendation",
  ],
});

function optionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
}

function options(values: readonly string[]) {
  return values.map((value) => ({ value, label: optionLabel(value) }));
}

export default function CreatorRightsAdvisorPage() {
  return (
    <main className="page">
      <p className="eyebrow">Creator Rights Advisor</p>
      <h1 className="page-title">Understand what to do before you publish.</h1>
      <p className="lede">
        The Advisor is free and does not require an account. Start from a file, source URL, package, DOI, ISBN, Steam
        page, or itch.io page; review what was found; compare license tradeoffs; set AI permissions; and prepare a draft
        Creator Rights Record before deciding whether to preserve it.
      </p>
      <div className="dashboard-actions">
        <Link className="button secondary" href="/rights">
          Browse public records
        </Link>
        <Link className="button" href="/login?next=/rights/create">
          Sign in to preserve a record
        </Link>
      </div>
      <p className="notice">
        Artifact first. Draft, not fact. Agreement increases confidence. Disagreement lowers confidence. Conflict never
        resolves silently.
      </p>

      <RightsCreateForm
        mode="advisor"
        email=""
        workTypes={options(workTypes)}
        categories={options(categoryValues)}
        availabilityCategories={options(availabilityCategories)}
        permissionValues={options(permissionValues)}
        disclaimer={RIGHTS_DISCLAIMER}
      />
    </main>
  );
}
