import jsQR from "jsqr";
import sharp from "sharp";

function normalizePayload(value: string) {
  return value.trim().replace(/\/+$/, "");
}

/**
 * Rasterize the generated SVG and decode it. Fails closed if the payload
 * is unreadable or does not match the durable public record URL.
 */
export async function verifyQrDecodesToUrl(svg: string, expectedUrl: string) {
  const raster = await sharp(Buffer.from(svg))
    .resize({ width: 900, height: 900, fit: "contain", background: { r: 15, g: 15, b: 21, alpha: 1 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const code = jsQR(new Uint8ClampedArray(raster.data), raster.info.width, raster.info.height, {
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

  return { decoded: code.data, width: raster.info.width, height: raster.info.height };
}
