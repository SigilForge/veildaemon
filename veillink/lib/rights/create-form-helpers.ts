import type { AiPermissionBlock, PermissionValue } from "@/lib/rights/schema";

export const sha256Example = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

export const recommendedAiPermissions: AiPermissionBlock = {
  generalTraining: "license_required",
  foundationModelPretraining: "license_required",
  fineTuning: "prohibited",
  embeddings: "license_required",
  rag: "license_required",
  generation: "license_required",
  datasetRedistribution: "prohibited",
  researchUse: "research_only",
  commercialUse: "license_required",
  attributionRequired: "license_required",
  licenseRequired: "license_required",
};

export const permissionPresets = {
  all_rights_reserved: {
    label: "All rights reserved",
    permissions: recommendedAiPermissions,
  },
  human_allowed_ai_training_prohibited: {
    label: "Human use allowed, AI training prohibited",
    permissions: {
      ...recommendedAiPermissions,
      generalTraining: "prohibited",
      foundationModelPretraining: "prohibited",
      embeddings: "license_required",
      rag: "license_required",
      generation: "license_required",
    },
  },
  noncommercial_attribution: {
    label: "Non-commercial reuse with attribution",
    permissions: {
      generalTraining: "prohibited",
      foundationModelPretraining: "prohibited",
      fineTuning: "prohibited",
      embeddings: "allowed",
      rag: "allowed",
      generation: "case_by_case",
      datasetRedistribution: "prohibited",
      researchUse: "research_only",
      commercialUse: "license_required",
      attributionRequired: "license_required",
      licenseRequired: "case_by_case",
    },
  },
  open_source_software: {
    label: "Open-source software defaults",
    permissions: {
      generalTraining: "license_required",
      foundationModelPretraining: "license_required",
      fineTuning: "prohibited",
      embeddings: "allowed",
      rag: "allowed",
      generation: "license_required",
      datasetRedistribution: "license_required",
      researchUse: "allowed",
      commercialUse: "allowed",
      attributionRequired: "license_required",
      licenseRequired: "license_required",
    },
  },
} satisfies Record<string, { label: string; permissions: AiPermissionBlock }>;

export type PermissionPresetKey = keyof typeof permissionPresets;
export type FingerprintMode = "file" | "hash" | "skip";

export function normalizeSlugInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function slugHelpText(title: string, slug: string) {
  const value = slug || normalizeSlugInput(title);
  return value ? `Public URL preview: /rights/${value}` : "Public URL preview appears after you enter a title.";
}

export function normalizeSha256Input(value: string) {
  return value.trim().toLowerCase();
}

export function sha256ValidationMessage(value: string) {
  const normalized = normalizeSha256Input(value);
  if (!normalized) return "";
  if (/\s/.test(value)) return "Remove spaces or line breaks. A SHA-256 hash is one continuous 64-character value.";
  if (/^sha256:/i.test(value.trim())) return "Remove the sha256: prefix and paste only the 64 hexadecimal characters.";
  if (!/^[a-f0-9]+$/i.test(normalized)) return "Use only hexadecimal characters: 0-9 and a-f.";
  if (normalized.length !== 64) return "SHA-256 must be exactly 64 hexadecimal characters.";
  return "";
}

export function isValidSha256(value: string) {
  return Boolean(normalizeSha256Input(value)) && !sha256ValidationMessage(value);
}

export function copyrightSuggestion(year: string, rightsHolderName: string) {
  const safeYear = year.trim() || new Date().getFullYear().toString();
  const holder = rightsHolderName.trim();
  return holder ? `Copyright © ${safeYear} ${holder}. All rights reserved.` : "";
}

export function fileMetadataForFingerprint(file: Pick<File, "name" | "size" | "type">) {
  return {
    fileName: file.name,
    fileSize: String(file.size),
    mimeType: file.type,
  };
}

export function permissionsForPreset(key: PermissionPresetKey | "custom") {
  if (key === "custom") return null;
  return permissionPresets[key].permissions;
}

function formatSentenceList(items: string[]) {
  if (items.length === 0) return "";
  const [first, ...rest] = items;
  const capitalizedFirst = first[0].toUpperCase() + first.slice(1);
  if (rest.length === 0) return capitalizedFirst;
  if (rest.length === 1) return `${capitalizedFirst} and ${rest[0]}`;
  return `${capitalizedFirst}, ${rest.slice(0, -1).join(", ")}, and ${rest[rest.length - 1]}`;
}

export function aiSummaryForPermissions(permissions: AiPermissionBlock) {
  const blocked = [
    permissions.generalTraining === "prohibited" ? "model training" : "",
    permissions.fineTuning === "prohibited" ? "fine-tuning" : "",
    permissions.datasetRedistribution === "prohibited" ? "dataset redistribution" : "",
  ].filter(Boolean);
  const licensed = [
    permissions.generalTraining === "license_required" ? "model training" : "",
    permissions.rag === "license_required" ? "retrieval use" : "",
    permissions.commercialUse === "license_required" ? "commercial use" : "",
  ].filter(Boolean);
  const allowed = [
    permissions.embeddings === "allowed" ? "embeddings" : "",
    permissions.researchUse === "research_only" ? "research use" : "",
  ].filter(Boolean);

  const sentences = [];
  if (blocked.length) sentences.push(`This work may not be used for ${blocked.join(", ")} without a separate written license.`);
  if (licensed.length) {
    const subject = formatSentenceList(licensed);
    sentences.push(`${subject} ${licensed.length === 1 ? "requires" : "require"} written permission.`);
  }
  if (allowed.length) sentences.push(`${formatSentenceList(allowed)} ${allowed.length === 1 ? "is" : "are"} permitted only within the stated record terms.`);
  return sentences.join(" ") || "AI use permissions are not specified; contact the rights holder before use.";
}

export function permissionMeaning(value: PermissionValue) {
  return {
    allowed: "This use is allowed under the stated record terms.",
    prohibited: "This use is not allowed without a separate written change.",
    license_required: "This use requires separate written permission or a license.",
    research_only: "This use is limited to research contexts under the stated terms.",
    case_by_case: "This use is reviewed individually before permission is granted.",
    custom_terms: "This use depends on custom terms described elsewhere in the record.",
    not_specified: "No permission posture is declared for this use.",
  }[value];
}
