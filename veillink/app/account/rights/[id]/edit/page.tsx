import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";
import { canEditRightsRecord } from "@/lib/rights/entitlement";
import { getOwnedRightsRecord } from "@/lib/rights/records";
import {
  RIGHTS_DISCLAIMER,
  availabilityCategories,
  categoryValues,
  permissionValues,
  workTypes,
} from "@/lib/rights/schema";
import { RightsEditForm } from "@/components/RightsEditForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = buildMetadata({
  title: "Edit Rights Record",
  description: "Update declared rights metadata for a Creator Rights Record.",
  path: "/account/rights",
  noIndex: true,
});

export default async function EditRightsRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser().catch(() => redirect("/login?next=/account/rights"));
  const { id } = await params;
  let record;
  try {
    record = await getOwnedRightsRecord(user.id, id);
  } catch {
    notFound();
  }
  if (!canEditRightsRecord(record)) {
    redirect("/account/rights");
  }

  const isDraft = record.record_status === "draft" || record.record_status === "pending_payment";

  return (
    <main className="page">
      <p className="eyebrow">Creator Rights</p>
      <h1 className="page-title">Edit record</h1>
      <p className="lede">
        {isDraft
          ? "Draft fields remain private until you publish the Rights Record."
          : "Issued records keep their public URL and record ID. Metadata updates create a new record version; regenerating a QR only bumps the QR asset version."}
      </p>
      <p className="notice">{RIGHTS_DISCLAIMER}</p>
      <div className="toolbar">
        <Link className="button secondary" href="/account/rights">
          Back to portal
        </Link>
      </div>
      <RightsEditForm
        recordId={record.id}
        isDraft={isDraft}
        initial={{
          title: record.title,
          description: record.description,
          creatorName: record.creator_name,
          publicDisplayName: record.public_display_name,
          rightsHolderName: record.rights_holder_name,
          workType: String(record.work_type),
          category: String(record.category),
          availability: String(record.availability),
          edition: record.edition || "",
          sourceUrl: record.source_url || "",
          licensingContact: record.licensing_contact || "",
          copyrightNotice: record.copyright_notice || "",
          rightsStatement: record.rights_statement,
          humanCommercialLicenseAvailable: record.human_commercial_license_available,
          permissions: record.ai_permissions as Record<string, string>,
        }}
        workTypes={[...workTypes]}
        categoryValues={[...categoryValues]}
        availabilityCategories={[...availabilityCategories]}
        permissionValues={[...permissionValues]}
      />
    </main>
  );
}
