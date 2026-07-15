const fs = require("fs");
const { readBarcodes, prepareZXingModule } = require("zxing-wasm/reader");
const MAX_BYTES = 4_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

prepareZXingModule({ overrides: { wasmBinary: fs.readFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm")) } });

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
function allowedHost(hostname) {
  const hosts = String(process.env.RELAY_IMAGE_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
function readBody(req) {
  return new Promise((resolve, reject) => { const chunks = []; let size = 0; req.on("data", (chunk) => { size += chunk.length; if (size > 8192) { reject(new Error("TOO_LARGE")); req.destroy(); } else chunks.push(chunk); }); req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8"))); req.on("error", reject); });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" }); }
  try {
    const { imageUrl } = JSON.parse(await readBody(req) || "{}");
    const url = new URL(imageUrl);
    if (url.protocol !== "https:" || !allowedHost(url.hostname.toLowerCase())) return send(res, 400, { status: "error", error: "REMOTE_HOST_NOT_ALLOWED" });
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(6000), headers: { Accept: "image/jpeg,image/png,image/webp,image/gif" } });
    const type = (response.headers.get("content-type") || "").split(";")[0];
    if (!response.ok || !ALLOWED_TYPES.has(type)) return send(res, 400, { status: "error", error: "REMOTE_RESOURCE_NOT_IMAGE" });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return send(res, 400, { status: "error", error: "IMAGE_TOO_LARGE" });
    const codes = await readBarcodes(bytes, { tryHarder: true, maxNumberOfSymbols: 8 });
    return send(res, 200, { status: codes.length ? "decoded" : "inconclusive", engine: "zxing-wasm-server", codes: codes.map((code) => ({ format: code.format, symbology: code.symbology, value: code.text, isQr: code.symbology === "QRCode", isUrl: /^https?:\/\//i.test(code.text || "") })) });
  } catch (_error) { return send(res, 500, { status: "error", error: "SCAN_FAILED" }); }
};
