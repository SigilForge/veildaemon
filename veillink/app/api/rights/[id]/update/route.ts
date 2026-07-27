import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/store";
import { updateOwnedRightsRecord } from "@/lib/rights/records";
import { aiPermissionBlockSchema } from "@/lib/rights/schema";
import { buildAiSummary } from "@/lib/rights/records";

function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ ok: false, error: error.issues.map((issue) => issue.message).join(" ") }, { status: 400 });
  }
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    let permissions = body.permissions;
    if (permissions) {
      permissions = aiPermissionBlockSchema.parse(permissions);
    }

    const record = await updateOwnedRightsRecord(user.id, id, {
      description: body.description,
      licensing_contact: body.licensingContact ?? body.licensing_contact,
      copyright_notice: body.copyrightNotice ?? body.copyright_notice,
      rights_statement: body.rightsStatement ?? body.rights_statement,
      availability: body.availability,
      edition: body.edition,
      source_url: body.sourceUrl ?? body.source_url,
      human_commercial_license_available: body.humanCommercialLicenseAvailable ?? body.human_commercial_license_available,
      filename: body.fileName ?? body.filename,
      file_size: body.fileSize ?? body.file_size,
      mime_type: body.mimeType ?? body.mime_type,
      sha256_hash: body.sha256Hash ?? body.sha256_hash,
      title: body.title,
      creator_name: body.creatorName ?? body.creator_name,
      public_display_name: body.publicDisplayName ?? body.public_display_name,
      rights_holder_name: body.rightsHolderName ?? body.rights_holder_name,
      work_type: body.workType ?? body.work_type,
      category: body.category,
      creation_date: body.creationDate ?? body.creation_date,
      publication_date: body.publicationDate ?? body.publication_date,
      external_identifier: body.externalIdentifier ?? body.external_identifier,
      permissions,
      aiPermissionsSummary: permissions ? buildAiSummary(permissions) : body.aiPermissionsSummary,
    });

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return jsonError(error);
  }
}
