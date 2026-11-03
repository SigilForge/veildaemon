import type { Resvg as ResvgClass, ResvgRenderOptions } from "@resvg/resvg-wasm";

/**
 * Pure resvg rendering shared by the Node path (lib/svg-raster.ts) and the
 * Cloudflare raster Worker (workers/raster). Callers are responsible for
 * initializing the wasm module and loading the font bytes; this file only
 * renders, so both runtimes produce byte-identical output.
 */

export const FONT_FAMILY = "Inter";

export type ContainedRaster = {
  data: Uint8Array;
  width: number;
  height: number;
};

type ResvgConstructor = typeof ResvgClass;

function fontOption(fontBytes: Uint8Array): NonNullable<ResvgRenderOptions["font"]> {
  return {
    fontBuffers: [fontBytes],
    defaultFontFamily: FONT_FAMILY,
    sansSerifFamily: FONT_FAMILY,
    monospaceFamily: FONT_FAMILY,
  };
}

/** Rasterize an SVG document to a PNG at its natural size. */
export function renderSvgToPng(Resvg: ResvgConstructor, fontBytes: Uint8Array, svg: string): Uint8Array {
  const resvg = new Resvg(svg, { font: fontOption(fontBytes) });
  try {
    const rendered = resvg.render();
    try {
      return rendered.asPng();
    } finally {
      rendered.free();
    }
  } finally {
    resvg.free();
  }
}

/**
 * Rasterize an SVG onto a `size` x `size` canvas of the given background
 * color, scaling to fit ("contain") and centering, and return raw RGBA
 * pixels. Mirrors the previous sharp pipeline:
 * `.resize({ width: size, height: size, fit: "contain", background }).ensureAlpha().raw()`.
 */
export function renderSvgToContainedRaw(
  Resvg: ResvgConstructor,
  fontBytes: Uint8Array,
  svg: string,
  size: number,
  background: { r: number; g: number; b: number }
): ContainedRaster {
  const font = fontOption(fontBytes);

  // First pass at natural size to learn the source dimensions.
  const probe = new Resvg(svg, { font });
  let probeImage;
  try {
    probeImage = probe.render();
  } finally {
    probe.free();
  }
  const srcWidth = probeImage.width;
  const srcHeight = probeImage.height;

  const zoom = Math.min(size / srcWidth, size / srcHeight);
  let pixels: Uint8Array;
  let renderedWidth = srcWidth;
  let renderedHeight = srcHeight;
  if (zoom === 1) {
    pixels = probeImage.pixels;
    probeImage.free();
  } else {
    probeImage.free();
    const scaled = new Resvg(svg, { fitTo: { mode: "zoom", value: zoom }, font });
    try {
      const image = scaled.render();
      try {
        pixels = image.pixels;
        renderedWidth = image.width;
        renderedHeight = image.height;
      } finally {
        image.free();
      }
    } finally {
      scaled.free();
    }
  }

  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = background.r;
    data[i + 1] = background.g;
    data[i + 2] = background.b;
    data[i + 3] = 255;
  }
  const offsetX = Math.max(0, Math.round((size - renderedWidth) / 2));
  const offsetY = Math.max(0, Math.round((size - renderedHeight) / 2));
  const copyWidth = Math.min(renderedWidth, size - offsetX);
  const copyHeight = Math.min(renderedHeight, size - offsetY);
  for (let y = 0; y < copyHeight; y += 1) {
    const srcStart = y * renderedWidth * 4;
    const destStart = ((y + offsetY) * size + offsetX) * 4;
    data.set(pixels.subarray(srcStart, srcStart + copyWidth * 4), destStart);
  }

  return { data, width: size, height: size };
}
