import { renderSvgToContainedRaw, renderSvgToPng } from "./svg-raster-core";
import type { ContainedRaster } from "./svg-raster-core";

export type { ContainedRaster } from "./svg-raster-core";

/**
 * SVG -> PNG rasterization built on @resvg/resvg-wasm.
 *
 * Replaces the previous sharp (libvips) calls, which cannot run in Cloudflare
 * Workers. Sharp was only ever used to rasterize an SVG string to PNG (and,
 * for QR verification, to produce raw pixels for jsQR) — both are reproduced
 * by lib/svg-raster-core.ts.
 *
 * Two backends, same rendering code:
 * - Node (Vitest, `next start`, local preview): initialize resvg from the
 *   installed package's wasm on disk and render in-process.
 * - Workers: no filesystem, and Workers refuse to compile wasm from bytes at
 *   runtime ("Wasm code generation disallowed by embedder"), so rendering is
 *   delegated to the veillink-raster Worker (workers/raster) through the
 *   RASTER service binding. That Worker imports the wasm at bundle time.
 *
 * Fonts: resvg ships no system fonts, so without an explicit font every
 * SVG <text> element renders as nothing (the framed QR styles — poster,
 * tech-card, neon — lost their titles/labels when sharp was replaced).
 * public/fonts/Inter-Bold.ttf (Inter, SIL OFL 1.1 — see public/fonts/
 * NOTICE) is passed to every render; see svg-raster-core.ts for how the
 * Inter and Consolas stacks resolve to it.
 */

type Backend = {
  png(svg: string): Promise<Uint8Array>;
  contained(svg: string, size: number, background: { r: number; g: number; b: number }): Promise<ContainedRaster>;
};

type ServiceBinding = { fetch: (request: Request) => Promise<Response> };

const FONT_FILE = "Inter-Bold.ttf";

let backendReady: Promise<Backend> | null = null;

async function localBackend(): Promise<Backend> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const wasmPath = join(process.cwd(), "node_modules", "@resvg", "resvg-wasm", "index_bg.wasm");
  const fontPath = join(process.cwd(), "public", "fonts", FONT_FILE);
  const [wasm, font] = await Promise.all([readFile(wasmPath), readFile(fontPath)]);
  const { initWasm, Resvg } = await import("@resvg/resvg-wasm");
  await initWasm(wasm);
  const fontBytes = new Uint8Array(font);
  return {
    png: async (svg) => renderSvgToPng(Resvg, fontBytes, svg),
    contained: async (svg, size, background) => renderSvgToContainedRaw(Resvg, fontBytes, svg, size, background),
  };
}

async function rasterServiceBackend(): Promise<Backend> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = getCloudflareContext() as unknown as { env: { RASTER?: ServiceBinding } };
  const raster = env.RASTER;
  if (!raster) {
    throw new Error("SVG rasterizer unavailable: no filesystem and no RASTER service binding.");
  }
  async function call(path: string, svg: string) {
    const response = await raster!.fetch(
      new Request(`https://veillink-raster.internal${path}`, { method: "POST", body: svg })
    );
    if (!response.ok) throw new Error(`SVG rasterizer failed (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }
  return {
    png: (svg) => call("/png", svg),
    contained: async (svg, size, { r, g, b }) => {
      const data = await call(`/contained?size=${size}&r=${r}&g=${g}&b=${b}`, svg);
      return { data, width: size, height: size };
    },
  };
}

function backend(): Promise<Backend> {
  if (!backendReady) {
    backendReady = localBackend()
      .catch(() => rasterServiceBackend())
      .catch((error) => {
        // Do not cache a failed setup; the next request retries.
        backendReady = null;
        throw error;
      });
  }
  return backendReady;
}

/** Rasterize an SVG document to a PNG at its natural size. */
export async function rasterizeSvgToPng(svg: string): Promise<Uint8Array> {
  return (await backend()).png(svg);
}

/**
 * Rasterize an SVG onto a `size` x `size` canvas of the given background
 * color, scaling to fit ("contain") and centering, and return raw RGBA
 * pixels.
 */
export async function rasterizeSvgToContainedRaw(
  svg: string,
  size: number,
  background: { r: number; g: number; b: number }
): Promise<ContainedRaster> {
  return (await backend()).contained(svg, size, background);
}
