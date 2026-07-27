import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";

const HOST = process.env.PLAYWRIGHT_STATIC_HOST || "127.0.0.1";
const PORT = Number(process.env.PLAYWRIGHT_STATIC_PORT || 4173);
const ROOT = process.cwd();

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const resolved = path.resolve(ROOT, `.${normalized}`);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) return null;
  return resolved;
}

async function resolveFile(urlPath) {
  const requested = safePath(urlPath);
  if (!requested) return null;
  try {
    const stat = await fs.stat(requested);
    if (stat.isDirectory()) return path.join(requested, "index.html");
    if (stat.isFile()) return requested;
  } catch (_) {
    return null;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const file = await resolveFile(req.url || "/");
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": TYPES[ext] || "application/octet-stream",
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`);
});
