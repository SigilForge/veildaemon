import jsQR from "jsqr";
import { rasterizeSvgToContainedRaw } from "../svg-raster";

function normalizePayload(value: string) {
  return value.trim().replace(/\/+$/, "");
}

/**
 * Rasterize the generated SVG and decode it. Fails closed if the payload
 * is unreadable or does not match the durable public record URL.
 */
export async function verifyQrDecodesToUrl(svg: string, expectedUrl: string) {
  const raster = await rasterizeSvgToContainedRaw(svg, 900, { r: 15, g: 15, b: 21 });

  const code = jsQR(new Uint8ClampedArray(raster.data), raster.width, raster.height, {
    inversionAttempts: "attemptBoth",
  });

  if (!code?.data) {
    throw Object.assign(new Error("Generated QR failed post-generation decode verification."), { status: 422 });
  }

  const expected = normalizePayload(expectedUrl);
  const decoded = normalizePayload(code.data);
  if (decoded !== expected) {
    throw Object.assign(
      new Error(`Generated QR payload mismatch. Expected ${expected}, decoded ${decoded}.`),
      { status: 422 }
    );
  }

  return { decoded: code.data, width: raster.width, height: raster.height };
}
