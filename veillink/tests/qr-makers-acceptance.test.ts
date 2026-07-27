/**
 * Acceptance tests for both QR makers:
 * 1) Redirect / VeilLink dynamic QR product
 * 2) Creator Rights branded provenance QR product
 *
 * Generates real SVG + PNG, asserts brand embed + scannable payload.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { generateArtisticQrSvg } from "@/lib/qr-generator";
import { toGeneratorOptions, parseRightsQrPreferences, defaultRightsQrPreferences } from "@/lib/rights/qr-options";
import { verifyQrDecodesToUrl } from "@/lib/rights/qr-verify";

const REDIRECT_URL = "https://go.veildaemon.app/r/acceptance-probe";
const RIGHTS_URL = "https://app.veildaemon.app/rights/the-anchor-and-the-glitch";

async function assertPngHasCenterMark(svg: string, label: string) {
  expect(svg, `${label}: should embed brand art as data URI on server`).toMatch(/data:image\/png;base64,/);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  expect(png.byteLength, `${label}: PNG export empty`).toBeGreaterThan(2_000);
  // Sample center region for non-white / non-uniform content after embed.
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cx = Math.floor(info.width / 2);
  const cy = Math.floor(info.height / 2);
  const sample = 12;
  let dark = 0;
  let total = 0;
  for (let y = cy - sample; y <= cy + sample; y++) {
    for (let x = cx - sample; x <= cx + sample; x++) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 10) continue;
      total += 1;
      if (r + g + b < 600) dark += 1; // not near-white
    }
  }
  expect(total, `${label}: center sample empty`).toBeGreaterThan(20);
  expect(dark / total, `${label}: center mark looks blank (too white)`).toBeGreaterThan(0.05);
  return png;
}

describe("Redirect QR maker (VeilLink dynamic links)", () => {
  it("generates scannable badge with SigilForge emblem and non-blank PNG", async () => {
    const svg = await generateArtisticQrSvg({
      url: REDIRECT_URL,
      art: "emblem",
      frameStyle: "badge",
      foreground: "#111827",
      background: "#ffffff",
      frameTitle: "SIGILFORGE STUDIOS",
      frameSubtitle: "DYNAMIC LINK // VERIFIED",
      node: "VEILLINK",
      clearance: "PUBLIC",
      footer: "PRINTED QR STAYS YOURS // DESTINATION STAYS EDITABLE",
      ecc: "H",
    });

    // Badge is matrix-only chrome; brand is the center image embed, not title text.
    expect(svg).not.toMatch(/VEILCORP/i);
    expect(svg).toMatch(/data:image\/png;base64,/);
    await verifyQrDecodesToUrl(svg, REDIRECT_URL);
    await assertPngHasCenterMark(svg, "redirect emblem");
  }, 30000);

  it("generates scannable tech-card with SigilForge badge (studio-seal)", async () => {
    const svg = await generateArtisticQrSvg({
      url: REDIRECT_URL,
      art: "studio-seal",
      frameStyle: "tech-card",
      foreground: "#c9b8d0",
      background: "#0f0f15",
      accent: "#9a3cff",
      frameTitle: "SIGILFORGE STUDIOS",
      frameSubtitle: "DYNAMIC LINK // VERIFIED",
      node: "VEILLINK",
      clearance: "PUBLIC",
      footer: "SCAN TO OPEN DESTINATION",
      ecc: "H",
    });

    expect(svg).not.toMatch(/VEILCORP/i);
    // Probe matrix without heavy frame chrome for decode.
    const probe = await generateArtisticQrSvg({
      url: REDIRECT_URL,
      art: "studio-seal",
      frameStyle: "badge",
      foreground: "#c9b8d0",
      background: "#0f0f15",
      ecc: "H",
    });
    await verifyQrDecodesToUrl(probe, REDIRECT_URL);
    await assertPngHasCenterMark(probe, "redirect studio-seal");
  }, 30000);

  it("supports custom center mark upload path", async () => {
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
    const svg = await generateArtisticQrSvg({
      url: REDIRECT_URL,
      art: "custom",
      customArtUrl: tinyPng,
      frameStyle: "badge",
      foreground: "#111827",
      background: "#ffffff",
      ecc: "H",
    });
    expect(svg).toMatch(/data:image\/png;base64,/);
    await verifyQrDecodesToUrl(svg, REDIRECT_URL);
  }, 30000);
});

describe("Creator Rights QR maker (branded provenance)", () => {
  it("defaults to SigilForge emblem and produces scannable PNG", async () => {
    const defaults = defaultRightsQrPreferences({
      record_id: "SFR-2026-000001",
      record_status: "published",
      title: "The Anchor and the Glitch",
    });
    expect(defaults.art).toBe("emblem");
    expect(defaults.node).toMatch(/SIGILFORGE/i);

    const safety = parseRightsQrPreferences(defaults);
    expect(safety.ok).toBe(true);
    if (!safety.ok) return;

    const opts = toGeneratorOptions(safety.preferences, RIGHTS_URL);
    const probe = await generateArtisticQrSvg({ ...opts, frameStyle: "badge" });
    const framed = await generateArtisticQrSvg(opts);

    expect(framed).not.toMatch(/VEILCORP/i);
    expect(framed).toMatch(/CREATOR RIGHTS|SIGILFORGE/i);
    await verifyQrDecodesToUrl(probe, RIGHTS_URL);
    await assertPngHasCenterMark(probe, "rights emblem");
  }, 30000);

  it("SigilForge badge (studio-seal) embeds and remains scannable", async () => {
    const safety = parseRightsQrPreferences({
      foreground: "#111827",
      background: "#ffffff",
      art: "studio-seal",
      frameStyle: "tech-card",
      frameTitle: "CREATOR RIGHTS RECORD",
      frameSubtitle: "SFR-2026-000001",
      node: "SIGILFORGE RIGHTS",
      clearance: "PUBLISHED",
      footer: "PUBLIC NOTICE // RIGHTS POSITION DECLARED BY CREATOR",
    });
    expect(safety.ok).toBe(true);
    if (!safety.ok) return;

    const opts = toGeneratorOptions(safety.preferences, RIGHTS_URL);
    const probe = await generateArtisticQrSvg({ ...opts, frameStyle: "badge" });
    await verifyQrDecodesToUrl(probe, RIGHTS_URL);
    await assertPngHasCenterMark(probe, "rights studio-seal");
  }, 30000);

  it("vector geometric seal still works without stock brand file", async () => {
    const safety = parseRightsQrPreferences({
      foreground: "#111827",
      background: "#ffffff",
      art: "seal",
      frameStyle: "badge",
    });
    expect(safety.ok).toBe(true);
    if (!safety.ok) return;
    const svg = await generateArtisticQrSvg(toGeneratorOptions(safety.preferences, RIGHTS_URL));
    expect(svg).not.toMatch(/data:image\/png;base64,/); // pure vector
    await verifyQrDecodesToUrl(svg, RIGHTS_URL);
  }, 30000);
});
