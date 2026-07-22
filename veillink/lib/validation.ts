import { z } from "zod";

export const reservedSlugs = new Set([
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "login",
  "logout",
  "signup",
  "register",
  "account",
  "billing",
  "support",
  "help",
  "status",
  "static",
  "assets",
  "go",
  "mail",
  "ftp",
  "ns1",
  "ns2",
]);

export const routingModes = ["path", "subdomain"] as const;
export const errorCorrectionLevels = ["L", "M", "Q", "H"] as const;

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export function validateSlug(value: string) {
  const slug = normalizeSlug(value);
  if (slug.length < 3 || slug.length > 63) {
    return { ok: false as const, error: "Slug must be 3 to 63 characters." };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false as const, error: "Use lowercase letters, numbers, and single hyphens only." };
  }
  if (reservedSlugs.has(slug)) {
    return { ok: false as const, error: "That slug is reserved." };
  }
  return { ok: true as const, slug };
}

export function validateDestinationUrl(value: string) {
  const raw = value.trim();
  if (!raw || raw.length > 2048) {
    return { ok: false as const, error: "Destination URL is required and must be under 2048 characters." };
  }
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false as const, error: "Destination must begin with http:// or https://." };
    }
    return { ok: true as const, url: url.toString() };
  } catch {
    return { ok: false as const, error: "Destination URL is malformed." };
  }
}

export function validateHexColor(value: string, fallback: string) {
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function luminance(hex: string) {
  const rgb = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export const redirectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80),
  routingMode: z.enum(routingModes),
  destinationUrl: z.string().trim().min(1).max(2048),
  active: z.boolean().default(true),
  expiresAt: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().default(""),
  qrForeground: z.string().trim().optional().default("#111827"),
  qrBackground: z.string().trim().optional().default("#ffffff"),
  qrEcc: z.enum(errorCorrectionLevels).optional().default("H"),
});
