import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/store";
import { createDraftRightsRecord } from "@/lib/rights/records";

function formValue(form: FormData, name: string) {
  return String(form.get(name) || "").trim();
}

function permissionsFromForm(form: FormData) {
  return {
    generalTraining: formValue(form, "permissions.generalTraining"),
    foundationModelPretraining: formValue(form, "permissions.foundationModelPretraining"),
    fineTuning: formValue(form, "permissions.fineTuning"),
    embeddings: formValue(form, "permissions.embeddings"),
    rag: formValue(form, "permissions.rag"),
    generation: formValue(form, "permissions.generation"),
    datasetRedistribution: formValue(form, "permissions.datasetRedistribution"),
    researchUse: formValue(form, "permissions.researchUse"),
    commercialUse: formValue(form, "permissions.commercialUse"),
    attributionRequired: formValue(form, "permissions.attributionRequired"),
    licenseRequired: formValue(form, "permissions.licenseRequired"),
  };
}

function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ ok: false, error: error.issues.map((issue) => issue.message).join(" ") }, { status: 400 });
  }
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    const form = await request.formData();
    const record = await createDraftRightsRecord(user.id, {
      creatorName: formValue(form, "creatorName"),
      publicDisplayName: formValue(form, "publicDisplayName"),
      rightsHolderName: formValue(form, "rightsHolderName"),
      email: formValue(form, "email") || user.email || "",
      title: formValue(form, "title"),
      slug: formValue(form, "slug"),
      workType: formValue(form, "workType") as never,
      availability: formValue(form, "availability") as never,
      description: formValue(form, "description"),
      creationDate: formValue(form, "creationDate"),
      publicationDate: formValue(form, "publicationDate"),
      edition: formValue(form, "edition"),
      sourceUrl: formValue(form, "sourceUrl"),
      externalIdentifier: formValue(form, "externalIdentifier"),
      licensingContact: formValue(form, "licensingContact"),
      copyrightNotice: formValue(form, "copyrightNotice"),
      rightsStatement: formValue(form, "rightsStatement"),
      aiSummaryApproved: formValue(form, "aiSummaryApproved") as "yes",
      permissions: permissionsFromForm(form) as never,
      humanCommercialLicenseAvailable: formValue(form, "humanCommercialLicenseAvailable") as never,
      fileName: formValue(form, "fileName"),
      fileSize: formValue(form, "fileSize") ? Number(formValue(form, "fileSize")) : undefined,
      mimeType: formValue(form, "mimeType"),
      sha256Hash: formValue(form, "sha256Hash"),
    });
    return NextResponse.redirect(new URL(`/account/rights?created=${record.id}`, request.url), 303);
  } catch (error) {
    return jsonError(error);
  }
}
