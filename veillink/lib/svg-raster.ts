import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { ResvgRenderOptions } from "@resvg/resvg-wasm";

/**
 * SVG -> PNG rasterization built on @resvg/resvg-wasm.
 *
 * Replaces the previous sharp (libvips) calls, which cannot run in Cloudflare
 * Workers. Sharp was only ever used to rasterize an SVG string to PNG (and,
 * for QR verification, to produce raw pixels for jsQR) — both are reproduced
 * here with resvg.
 *
 * Wasm loading: the resvg wasm binary ships as a static asset at
 * public/resvg/index_bg.wasm (copied verbatim from the installed
 * @resvg/resvg-wasm package — keep the copy in sync when the package is
 * upgraded). Importing the `.wasm` through the bundler is not viable here:
 * Turbopack cannot resolve the wasm-bindgen `wbg` glue imports, and plain
 * Node module loaders (Vitest) fail on the asset import as well. So the
 * bytes are loaded at runtime instead:
 * - Node (Vitest, `next start`, local preview): read the installed package
 *   from disk.
 * - Workers: no filesystem, so fetch the static asset through the ASSETS
 *   binding. The wasm bytes live in static assets, not the Worker script,
 *   so they do not count against the Worker size limit.
 *
 * Fonts: resvg ships no system fonts, so without an explicit font every
 * SVG <text> element renders as nothing (the framed QR styles — poster,
 * tech-card, neon — lost their titles/labels when sharp was replaced).
 * public/fonts/Inter-Bold.ttf (Inter, SIL OFL 1.1 — see public/fonts/
 * NOTICE) is loaded with the same fs-then-ASSETS pattern as the wasm and
 * passed to every render via `fontBuffers`. The QR frames request
 * "Inter, system-ui, sans-serif" (titles) and "Consolas, monospace"
 * (labels); the loaded face is registered as the default, sans-serif,
 * and monospace family, so the Inter stack matches by name and the
 * Consolas stack falls back to it instead of vanishing.
 */

let resvgReady: Promise<void> | null = null;

function ensureResvgReady(): Promise<void> {
  if (!resvgReady) {
    resvgReady = (async () => {
      try {
        const { readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const wasmPath = join(process.cwd(), "node_modules", "@resvg", "resvg-wasm", "index_bg.wasm");
        await initWasm(await readFile(wasmPath));
        return;
      } catch {
        // No readable filesystem (Cloudflare Workers) — use the ASSETS asset.
      }
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env } = getCloudflareContext() as unknown as {
        env: { ASSETS?: { fetch: (request: Request) => Promise<Response> } };
      };
      if (!env.ASSETS) {
        throw new Error("resvg wasm asset unavailable: no filesystem and no ASSETS binding.");
      }
      const response = await env.ASSETS.fetch(new Request("https://assets.local/resvg/index_bg.wasm"));
      if (!response.ok) {
        throw new Error(`resvg wasm asset fetch failed (${response.status}).`);
      }
      await initWasm(await response.arrayBuffer());
    })();
  }
  return resvgReady;
}

const FONT_FILE = "Inter-Bold.ttf";
const FONT_FAMILY = "Inter";

let fontBytesReady: Promise<Uint8Array> | null = null;

function ensureFontBytes(): Promise<Uint8Array> {
  if (!fontBytesReady) {
    fontBytesReady = (async () => {
      try {
        const { readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const fontPath = join(process.cwd(), "public", "fonts", FONT_FILE);
        return new Uint8Array(await readFile(fontPath));
      } catch {
        // No readable filesystem (Cloudflare Workers) — use the ASSETS asset.
      }
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env } = getCloudflareContext() as unknown as {
        env: { ASSETS?: { fetch: (request: Request) => Promise<Response> } };
      };
      if (!env.ASSETS) {
        throw new Error("font asset unavailable: no filesystem and no ASSETS binding.");
      }
      const response = await env.ASSETS.fetch(
        new Request(`https://assets.local/fonts/${FONT_FILE}`)
      );
      if (!response.ok) {
        throw new Error(`font asset fetch failed (${response.status}).`);
      }
      return new Uint8Array(await response.arrayBuffer());
    })();
  }
  return fontBytesReady;
}

async function fontOption(): Promise<NonNullable<ResvgRenderOptions["font"]>> {
  const fontBytes = await ensureFontBytes();
  return {
    fontBuffers: [fontBytes],
    defaultFontFamily: FONT_FAMILY,
    sansSerifFamily: FONT_FAMILY,
    monospaceFamily: FONT_FAMILY,
  };
}

/** Rasterize an SVG document to a PNG at its natural size. */
export async function rasterizeSvgToPng(svg: string): Promise<Uint8Array> {
  await ensureResvgReady();
  const resvg = new Resvg(svg, { font: await fontOption() });
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

export type ContainedRaster = {
  data: Uint8Array;
  width: number;
  height: number;
};

/**
 * Rasterize an SVG onto a `size` x `size` canvas of the given background
 * color, scaling to fit ("contain") and centering, and return raw RGBA
 * pixels. Mirrors the previous sharp pipeline:
 * `.resize({ width: size, height: size, fit: "contain", background }).ensureAlpha().raw()`.
 */
export async function rasterizeSvgToContainedRaw(
  svg: string,
  size: number,
  background: { r: number; g: number; b: number }
): Promise<ContainedRaster> {
  await ensureResvgReady();
  const font = await fontOption();

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
