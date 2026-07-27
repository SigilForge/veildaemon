import { z } from "zod";
import { contrastRatio, validateHexColor } from "@/lib/validation";
import type { QrArtOption, QrFrameStyleOption } from "@/lib/types";

/** Rights QR is always high error-correction; client/server cannot lower it. */
export const RIGHTS_QR_ECC = "H" as const;

/** Quiet zone in modules around the code (ISO guidance is ≥4; we keep ≥3 and enforce here). */
export const RIGHTS_QR_MIN_QUIET_ZONE = 3;

/** Minimum WCAG-ish contrast for scan reliability on print and screens. */
export const RIGHTS_QR_MIN_CONTRAST = 4.5;

/**
 * Maximum center mark diameter as a fraction of the QR module field.
 * ECC H tolerates roughly up to ~30% damage; we stay well under that.
 */
export const RIGHTS_QR_MAX_CENTER_FRACTION = 0.24;

/** emblem / studio-seal load real SigilForge brand files; seal/mark are geometric only. */
export const rightsQrArtOptions = ["none", "emblem", "studio-seal", "seal", "mark", "custom"] as const;
export const rightsQrFrameStyles = ["badge", "tech-card", "poster", "neon"] as const;

/**
 * Cap custom center-mark payloads (data URLs). Base64 expands ~4/3 over raw file size,
 * so allow headroom above a ~120KB upload limit in the UI.
 */
export const RIGHTS_QR_MAX_CUSTOM_ART_CHARS = 350_000;
export const RIGHTS_QR_MAX_CUSTOM_ART_FILE_BYTES = 120_000;

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colors must be 6-digit hex (#rrggbb).");

const labelField = z.string().trim().max(80);

const customArtField = z
  .string()
  .trim()
  .max(RIGHTS_QR_MAX_CUSTOM_ART_CHARS, "Custom center art is too large. Use a smaller PNG/WebP/SVG under ~150KB.")
  .or(z.literal(""))
  .default("");

export const rightsQrPreferencesSchema = z.object({
  foreground: hexColor.default("#c9b8d0"),
  background: hexColor.default("#0f0f15"),
  accent: hexColor.or(z.literal("")).default("#9a3cff"),
  eyeColor: hexColor.or(z.literal("")).default(""),
  art: z.enum(rightsQrArtOptions).default("emblem"),
  /** data: URL or https image for art=custom only */
  customArtUrl: customArtField,
  frameStyle: z.enum(rightsQrFrameStyles).default("tech-card"),
  frameTitle: labelField.default("CREATOR RIGHTS RECORD"),
  frameSubtitle: labelField.default(""),
  node: labelField.default("SIGILFORGE RIGHTS"),
  clearance: labelField.default(""),
  footer: z.string().trim().max(120).default("PUBLIC NOTICE // RIGHTS POSITION DECLARED BY CREATOR"),
});

export type RightsQrPreferences = z.infer<typeof rightsQrPreferencesSchema>;

export type RightsQrSafetyResult =
  | { ok: true; preferences: RightsQrPreferences; contrast: number }
  | { ok: false; error: string };

export function parseRightsQrPreferences(raw: unknown): RightsQrSafetyResult {
  const parsed = rightsQrPreferencesSchema.safeParse(raw || {});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }
  const preferences = parsed.data;
  const fg = validateHexColor(preferences.foreground, "#c9b8d0");
  const bg = validateHexColor(preferences.background, "#0f0f15");
  const contrast = contrastRatio(fg, bg);
  if (contrast < RIGHTS_QR_MIN_CONTRAST) {
    return {
      ok: false,
      error: `Foreground and background need stronger contrast (minimum ${RIGHTS_QR_MIN_CONTRAST}:1). Current ratio is ${contrast.toFixed(2)}:1.`,
    };
  }

  const customArtUrl = preferences.customArtUrl?.trim() || "";
  if (preferences.art === "custom") {
    if (!customArtUrl) {
      return { ok: false, error: "Custom center mark requires an uploaded image." };
    }
    const allowed =
      customArtUrl.startsWith("data:image/png") ||
      customArtUrl.startsWith("data:image/jpeg") ||
      customArtUrl.startsWith("data:image/webp") ||
      customArtUrl.startsWith("data:image/svg+xml") ||
      /^https:\/\//i.test(customArtUrl);
    if (!allowed) {
      return { ok: false, error: "Custom center mark must be a PNG, JPEG, WebP, or SVG upload (or https image URL)." };
    }
  }

  return {
    ok: true,
    contrast,
    preferences: {
      ...preferences,
      foreground: fg,
      background: bg,
      accent: preferences.accent ? validateHexColor(preferences.accent, "#9a3cff") : "",
      eyeColor: preferences.eyeColor ? validateHexColor(preferences.eyeColor, fg) : "",
      customArtUrl: preferences.art === "custom" ? customArtUrl : "",
    },
  };
}

export function preferencesFromSearchParams(params: URLSearchParams): unknown {
  return {
    foreground: params.get("fg") || undefined,
    background: params.get("bg") || undefined,
    accent: params.get("accent") || undefined,
    eyeColor: params.get("eye") || undefined,
    art: params.get("art") || undefined,
    frameStyle: params.get("frame") || params.get("frameStyle") || undefined,
    frameTitle: params.get("title") || params.get("frameTitle") || undefined,
    frameSubtitle: params.get("subtitle") || params.get("frameSubtitle") || undefined,
    node: params.get("node") || undefined,
    clearance: params.get("clearance") || undefined,
    footer: params.get("footer") || undefined,
  };
}

export function defaultRightsQrPreferences(record: {
  record_id?: string | null;
  record_status?: string;
  title?: string;
}): RightsQrPreferences {
  return rightsQrPreferencesSchema.parse({
    frameTitle: "CREATOR RIGHTS RECORD",
    frameSubtitle: record.record_id || "ISSUED RECORD",
    node: "SIGILFORGE RIGHTS",
    clearance: (record.record_status || "PUBLISHED").toUpperCase(),
    footer: "PUBLIC NOTICE // RIGHTS POSITION DECLARED BY CREATOR",
    art: "emblem",
    frameStyle: "tech-card",
  });
}

export function toGeneratorOptions(preferences: RightsQrPreferences, url: string) {
  const hasCustom = preferences.art === "custom" && Boolean(preferences.customArtUrl?.trim());
  // Preview-friendly: custom without an upload yet falls back to a clean matrix (same as redirect QR studio).
  const art = (preferences.art === "custom" && !hasCustom ? "none" : preferences.art) as QrArtOption;
  return {
    url,
    foreground: preferences.foreground,
    background: preferences.background,
    accent: preferences.accent || undefined,
    eyeColor: preferences.eyeColor || undefined,
    art,
    customArtUrl: hasCustom ? preferences.customArtUrl || "" : "",
    frameStyle: preferences.frameStyle as QrFrameStyleOption,
    frameTitle: preferences.frameTitle,
    frameSubtitle: preferences.frameSubtitle,
    node: preferences.node,
    clearance: preferences.clearance,
    footer: preferences.footer,
    ecc: RIGHTS_QR_ECC,
    // Generator already clears center; safety module re-checks fraction.
    maxCenterFraction: RIGHTS_QR_MAX_CENTER_FRACTION,
    minQuietZone: RIGHTS_QR_MIN_QUIET_ZONE,
  };
}

/** Strict validation for download/save (custom mark required if art=custom). */
export function parseRightsQrPreferencesForExport(raw: unknown): RightsQrSafetyResult {
  return parseRightsQrPreferences(raw);
}

/**
 * Preview validation: allow art=custom before an image is chosen so the QR matrix stays live.
 * Mirrors the original redirect QR studio behavior.
 */
export function parseRightsQrPreferencesForPreview(raw: unknown): RightsQrSafetyResult {
  const soft =
    raw && typeof raw === "object"
      ? {
          ...(raw as Record<string, unknown>),
          // Temporarily treat empty custom as "none" for schema acceptance, then restore art flag.
          art:
            (raw as { art?: string }).art === "custom" && !(raw as { customArtUrl?: string }).customArtUrl
              ? "none"
              : (raw as { art?: string }).art,
        }
      : raw;
  const result = parseRightsQrPreferences(soft);
  if (!result.ok || !raw || typeof raw !== "object") return result;
  const originalArt = (raw as { art?: string }).art;
  if (originalArt === "custom") {
    return {
      ...result,
      preferences: {
        ...result.preferences,
        art: "custom",
        customArtUrl: String((raw as { customArtUrl?: string }).customArtUrl || ""),
      },
    };
  }
  return result;
}
