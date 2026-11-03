/**
 * veillink-raster: SVG -> PNG / raw RGBA for the VeilLink Worker.
 *
 * Cloudflare Workers refuse to compile WebAssembly from bytes at runtime
 * ("Wasm code generation disallowed by embedder"), so the app Worker cannot
 * initialize resvg from a fetched asset. Wrangler bundles this Worker's
 * `.wasm` import as a precompiled WebAssembly.Module, which Workers allow.
 * The app reaches it only through the RASTER service binding (no public
 * route is needed; workers_dev is disabled in wrangler.jsonc).
 *
 *   POST /png                        body: SVG text -> image/png
 *   POST /contained?size=&r=&g=&b=   body: SVG text -> raw RGBA (size*size*4)
 */
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import interBold from "../../public/fonts/Inter-Bold.ttf";
import { renderSvgToContainedRaw, renderSvgToPng } from "../../lib/svg-raster-core";

const MAX_SVG_BYTES = 2_000_000;
const MAX_SIZE = 2048;

let ready: Promise<void> | null = null;
const fontBytes = new Uint8Array(interBold);

function channel(value: string | null) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 255 ? n : null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed.", { status: 405 });
    const svg = await request.text();
    if (!svg || svg.length > MAX_SVG_BYTES) return new Response("Invalid SVG.", { status: 400 });

    ready ??= initWasm(resvgWasm).catch((error) => {
      ready = null;
      throw error;
    });
    await ready;

    const url = new URL(request.url);
    if (url.pathname === "/png") {
      const png = renderSvgToPng(Resvg, fontBytes, svg);
      return new Response(png.slice(), { headers: { "Content-Type": "image/png" } });
    }
    if (url.pathname === "/contained") {
      const size = Number(url.searchParams.get("size"));
      const r = channel(url.searchParams.get("r"));
      const g = channel(url.searchParams.get("g"));
      const b = channel(url.searchParams.get("b"));
      if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE || r === null || g === null || b === null) {
        return new Response("Invalid raster parameters.", { status: 400 });
      }
      const raster = renderSvgToContainedRaw(Resvg, fontBytes, svg, size, { r, g, b });
      return new Response(raster.data.slice(), { headers: { "Content-Type": "application/octet-stream" } });
    }
    return new Response("Not found.", { status: 404 });
  },
};
