import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(repoRoot, "stream", "brb", "assets", "brb-screen.webp");
const outputPath = path.join(repoRoot, "stream", "brb", "assets", "brb-screen.webm");

const result = spawnSync("ffmpeg", [
  "-hide_banner",
  "-loglevel", "error",
  "-fflags", "+bitexact",
  "-loop", "1",
  "-framerate", "1",
  "-i", inputPath,
  "-vf", "fps=1",
  "-r", "1",
  "-t", "10",
  "-an",
  "-c:v", "libvpx-vp9",
  "-flags:v", "+bitexact",
  "-deadline", "good",
  "-cpu-used", "2",
  "-threads", "1",
  "-g", "300",
  "-crf", "30",
  "-b:v", "0",
  "-pix_fmt", "yuv420p",
  "-y",
  outputPath,
], { stdio: "inherit" });

if (result.error?.code === "ENOENT") {
  console.error("BRB WebM build failed: ffmpeg is not installed or not on PATH.");
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`BRB WebM build failed with ffmpeg exit code ${result.status}.`);
  process.exit(result.status || 1);
}

console.log(`Built ${path.relative(repoRoot, outputPath)} from the WebP master.`);
