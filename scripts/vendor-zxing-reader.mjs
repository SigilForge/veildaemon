import fs from "node:fs/promises";
import path from "node:path";

const source = path.resolve("node_modules/zxing-wasm/dist");
const target = path.resolve("studio/relay/vendor");

await fs.mkdir(target, { recursive: true });
await fs.copyFile(path.join(source, "iife/reader/index.js"), path.join(target, "zxing-reader.js"));
await fs.copyFile(path.join(source, "reader/zxing_reader.wasm"), path.join(target, "zxing_reader.wasm"));
console.log("Vendored local ZXing reader assets for RelayDaemon.");
