import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/store";
import {
  buildDossierSnapshot,
  dossierPurposeValues,
  dossierSectionValues,
  nextDossierVersion,
  persistDossierSnapshot,
  type DossierPurpose,
  type DossierSection,
} from "@/lib/rights/dossier";
import { getOwnedRightsRecord } from "@/lib/rights/records";
import { effectiveVerification } from "@/lib/rights/verification";
import { listVerificationState } from "@/lib/rights/verification-store";

function formValues(form: FormData, name: string) {
  return form.getAll(name).map((value) => String(value));
}

function safeFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "creator-dossier";
}

function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await context.params;
    const record = await getOwnedRightsRecord(user.id, id);
    const form = await request.formData();
    const format = String(form.get("format") || "html");
    const purposeInput = String(form.get("purpose") || "general");
    const purpose = dossierPurposeValues.includes(purposeInput as DossierPurpose)
      ? (purposeInput as DossierPurpose)
      : "general";
    const sections = formValues(form, "sections").filter((section): section is DossierSection =>
      dossierSectionValues.includes(section as DossierSection)
    );
    const verification = await listVerificationState(record, true)
      .then((state) => state.projection)
      .catch(() => effectiveVerification(record));
    const dossierVersion = await nextDossierVersion(record.id);
    const snapshot = buildDossierSnapshot({
      record,
      userId: user.id,
      input: {
        purpose,
        includedSections: sections,
        suspectedUse: {
          providerName: String(form.get("suspected.providerName") || ""),
          modelName: String(form.get("suspected.modelName") || ""),
          observedAt: String(form.get("suspected.observedAt") || ""),
          allegationType: String(form.get("suspected.allegationType") || ""),
          factualObservation: String(form.get("suspected.factualObservation") || ""),
          creatorInterpretation: String(form.get("suspected.creatorInterpretation") || ""),
          testingMethod: String(form.get("suspected.testingMethod") || ""),
          status: String(form.get("suspected.status") || "creator_reported"),
        },
      },
      dossierVersion,
      verification,
    });
    await persistDossierSnapshot({ recordId: record.id, userId: user.id, snapshot });

    const filename = `${safeFilename(record.title)}-creator-dossier-v${dossierVersion}`;
    if (format === "manifest") {
      return new NextResponse(JSON.stringify(snapshot.manifest, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}-manifest.json"`,
          "x-dossier-id": snapshot.dossierId,
          "x-dossier-manifest-sha256": snapshot.exportHashes.manifestSha256,
          "x-dossier-package-sha256": snapshot.exportHashes.packageSha256,
        },
      });
    }

    return new NextResponse(snapshot.html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}.html"`,
        "x-dossier-id": snapshot.dossierId,
        "x-dossier-html-sha256": snapshot.exportHashes.htmlSha256,
        "x-dossier-manifest-sha256": snapshot.exportHashes.manifestSha256,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
