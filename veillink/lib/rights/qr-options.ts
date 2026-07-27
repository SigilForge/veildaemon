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

export const rightsQrArtOptions = ["none", "emblem", "seal", "mark", "studio-seal"] as const;
export const rightsQrFrameStyles = ["badge", "tech-card", "poster", "neon"] as const;

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colors must be 6-digit hex (#rrggbb).");

const labelField = z.string().trim().max(80);

export const rightsQrPreferencesSchema = z.object({
  foreground: hexColor.default("#c9b8d0"),
  background: hexColor.default("#0f0f15"),
  accent: hexColor.or(z.literal("")).default("#9a3cff"),
  eyeColor: hexColor.or(z.literal("")).default(""),
  art: z.enum(rightsQrArtOptions).default("seal"),
  frameStyle: z.enum(rightsQrFrameStyles).default("tech-card"),
  frameTitle: labelField.default("CREATOR RIGHTS RECORD"),
  frameSubtitle: labelField.default(""),
  node: labelField.default("RIGHTS REGISTRY"),
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
  return {
    ok: true,
    contrast,
    preferences: {
      ...preferences,
      foreground: fg,
      background: bg,
      accent: preferences.accent ? validateHexColor(preferences.accent, "#9a3cff") : "",
      eyeColor: preferences.eyeColor ? validateHexColor(preferences.eyeColor, fg) : "",
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
    node: "RIGHTS REGISTRY",
    clearance: (record.record_status || "PUBLISHED").toUpperCase(),
    footer: "PUBLIC NOTICE // RIGHTS POSITION DECLARED BY CREATOR",
    art: "seal",
    frameStyle: "tech-card",
  });
}

export function toGeneratorOptions(preferences: RightsQrPreferences, url: string) {
  return {
    url,
    foreground: preferences.foreground,
    background: preferences.background,
    accent: preferences.accent || undefined,
    eyeColor: preferences.eyeColor || undefined,
    art: preferences.art as QrArtOption,
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
