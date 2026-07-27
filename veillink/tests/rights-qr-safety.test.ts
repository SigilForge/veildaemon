import { describe, expect, it } from "vitest";
import { generateArtisticQrSvg } from "@/lib/qr-generator";
import {
  RIGHTS_QR_ECC,
  RIGHTS_QR_MIN_CONTRAST,
  parseRightsQrPreferences,
  toGeneratorOptions,
} from "@/lib/rights/qr-options";
import { verifyQrDecodesToUrl } from "@/lib/rights/qr-verify";

describe("Creator Rights QR safety", () => {
  it("forces high contrast and high ECC options for issued assets", () => {
    const safety = parseRightsQrPreferences({
      foreground: "#111827",
      background: "#ffffff",
      art: "seal",
      frameStyle: "badge",
    });
    expect(safety.ok).toBe(true);
    if (!safety.ok) return;
    expect(safety.contrast).toBeGreaterThanOrEqual(RIGHTS_QR_MIN_CONTRAST);
    const opts = toGeneratorOptions(safety.preferences, "https://app.veildaemon.app/rights/demo-work");
    expect(opts.ecc).toBe(RIGHTS_QR_ECC);
    expect(opts.minQuietZone).toBeGreaterThanOrEqual(3);
    expect(opts.maxCenterFraction).toBeLessThanOrEqual(0.24);
  });

  it("decode-verifies a branded rights QR against the durable record URL", async () => {
    const durableUrl = "https://app.veildaemon.app/rights/decode-probe-work";
    const safety = parseRightsQrPreferences({
      foreground: "#111827",
      background: "#ffffff",
      art: "seal",
      frameStyle: "badge",
    });
    expect(safety.ok).toBe(true);
    if (!safety.ok) return;
    const svg = await generateArtisticQrSvg(toGeneratorOptions(safety.preferences, durableUrl));
    const result = await verifyQrDecodesToUrl(svg, durableUrl);
    expect(result.decoded.replace(/\/+$/, "")).toBe(durableUrl);
  }, 20000);
});
