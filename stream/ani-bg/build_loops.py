#!/usr/bin/env python3
"""Rebuild seamless alpha VP9 OBS cutouts from the original animation frames.

The source clip is not cyclic. Rotate it past its first overlap, then dissolve
the last overlap against that first section. The resulting last frame leads
naturally back into the first. Reapply the *original* hard-edged alpha masks;
never dissolve the monitor hole, bezel, or OBS content.
"""
from __future__ import annotations

import argparse
from fractions import Fraction
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
VARIANTS = ("70", "80", "90")


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {result.stderr}")
    return result


def probe(path: Path, *, count_frames: bool = False) -> dict:
    args = ["ffprobe", "-v", "error"]
    if count_frames:
        args.append("-count_frames")
    args += [
        "-show_entries",
        "stream=codec_name,width,height,avg_frame_rate,nb_frames,nb_read_frames,pix_fmt:stream_tags=ALPHA_MODE",
        "-show_entries",
        "format=duration",
        "-of", "json", str(path),
    ]
    result = json.loads(run(args).stdout)
    return {"stream": result["streams"][0], "duration": float(result["format"]["duration"])}


def build(variant: str, overlap: int, crf: int, dry_run: bool) -> None:
    source = ASSETS / f"{variant}-screen-frame.mp4"
    mask = ASSETS / f"{variant}-mask.png"
    target = ASSETS / f"{variant}-screen-cutout.webm"
    if not source.is_file() or not mask.is_file():
        raise FileNotFoundError(f"Missing source and/or mask for variant {variant}")
    meta = probe(source)
    stream = meta["stream"]
    fps = Fraction(stream["avg_frame_rate"])
    if fps != Fraction(24) or (stream["width"], stream["height"]) != (1472, 608):
        raise ValueError(f"Unexpected source for {variant}: {stream}")
    frames = int(stream["nb_frames"])
    if overlap < 2 or frames <= 2 * overlap:
        raise ValueError(f"Overlap {overlap} invalid for {frames} frames")

    # Output timeline: source[overlap:frames], with its last overlap crossfaded
    # to source[0:overlap]. End ~= source[overlap-1], start = source[overlap].
    # No duplicated freeze frame, reversed raindrops, or fade-to-black.
    output_frames = frames - overlap
    duration = overlap / float(fps)
    offset = (frames - 2 * overlap) / float(fps)
    filters = (
        "[0:v]split=2[rotated][leading];"
        f"[rotated]trim=start_frame={overlap},setpts=PTS-STARTPTS[tail];"
        f"[leading]trim=end_frame={overlap},setpts=PTS-STARTPTS[head];"
        f"[tail][head]xfade=transition=fade:duration={duration:.9f}:"
        f"offset={offset:.9f},format=yuv420p[loop];"
        "[1:v]scale=1472:608:flags=neighbor,format=gray[hardmask];"
        "[loop][hardmask]alphamerge,format=yuva420p[out]"
    )
    tmp = target.with_name(f".{target.stem}.building.webm")
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source),
        "-loop", "1", "-framerate", str(fps.numerator), "-i", str(mask),
        "-filter_complex", filters,
        "-map", "[out]", "-frames:v", str(output_frames),
        "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(crf),
        "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-threads", "4",
        "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
        "-metadata:s:v:0", "alpha_mode=1",
        "-f", "webm", str(tmp),
    ]
    print(f"{variant}%: {frames} source frames -> {output_frames} loop frames; "
          f"crossfade {duration:.3f}s; duration {output_frames / float(fps):.3f}s", flush=True)
    if dry_run:
        print("  " + " ".join(cmd))
        return
    try:
        run(cmd)
        built = probe(tmp, count_frames=True)
        new_stream = built["stream"]
        actual = int(new_stream.get("nb_read_frames") or 0)
        alpha = new_stream.get("tags", {}).get("ALPHA_MODE")
        if new_stream.get("codec_name") != "vp9" or actual != output_frames or alpha != "1":
            raise RuntimeError(f"{variant}% verification failed: {built}")
        if abs(built["duration"] - output_frames / float(fps)) > 0.06:
            raise RuntimeError(f"{variant}% incorrect duration: {built['duration']}")
        os.replace(tmp, target)
        print(f"  Saved {target.name} ({target.stat().st_size:,} bytes; alpha intact)", flush=True)
    finally:
        if tmp.exists():
            tmp.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("variants", nargs="*", choices=VARIANTS, default=list(VARIANTS))
    parser.add_argument("--overlap-frames", type=int, default=36,
                        help="24fps frames to overlap, default 36 (1.5 seconds)")
    parser.add_argument("--crf", type=int, default=26)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        parser.error("ffmpeg and ffprobe are required")
    for variant in args.variants or VARIANTS:
        build(variant, args.overlap_frames, args.crf, args.dry_run)


if __name__ == "__main__":
    main()
