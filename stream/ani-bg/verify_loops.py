#!/usr/bin/env python3
"""Check the OBS rain-loop videos for decoding, transparency, and seam jumps."""
from __future__ import annotations

from pathlib import Path
import subprocess

from build_loops import ASSETS, VARIANTS, probe

SAMPLE_WIDTH, SAMPLE_HEIGHT = 368, 152


def rgb_frames(path: Path, indexes: tuple[int, ...], vp9: bool = False) -> list[bytes]:
    expression = "+".join(f"eq(n\\,{n})" for n in indexes)
    args = ["ffmpeg", "-v", "error"]
    if vp9:
        args += ["-c:v", "libvpx-vp9"]
    args += [
        "-i", str(path), "-vf",
        f"select={expression},scale={SAMPLE_WIDTH}:{SAMPLE_HEIGHT}:flags=area,format=rgb24",
        "-fps_mode", "passthrough", "-frames:v", str(len(indexes)),
        "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ]
    data = subprocess.run(args, check=True, stdout=subprocess.PIPE).stdout
    step = SAMPLE_WIDTH * SAMPLE_HEIGHT * 3
    if len(data) != step * len(indexes):
        raise ValueError(f"Could not extract sample frames for {path.name}")
    return [data[i:i + step] for i in range(0, len(data), step)]


def distance(a: bytes, b: bytes) -> float:
    return sum(abs(x-y) for x, y in zip(a, b)) / len(a)


def verify_alpha(path: Path) -> None:
    args = [
        "ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", str(path),
        "-frames:v", "1", "-vf", "format=rgba", "-pix_fmt", "rgba",
        "-f", "rawvideo", "pipe:1",
    ]
    raw = subprocess.run(args, check=True, stdout=subprocess.PIPE).stdout
    width, height = 1472, 608
    if len(raw) != width * height * 4:
        raise ValueError(f"{path.name}: missing decoded RGBA")
    alphas = raw[3::4]
    values = set(alphas)
    # VP9 can shift a few edge pixels by 1-2 opacity levels during encoding.
    # These are visually binary, unlike a blended monitor opening.
    if any(3 <= value <= 252 for value in values):
        raise ValueError(f"{path.name}: meaningful soft alpha values: {sorted(values)[:20]}")
    if not ({0, 255} <= values):
        raise ValueError(f"{path.name}: missing transparent or opaque pixels: {values}")
    fringe = sum(value not in (0, 255) for value in alphas)
    print(f"  Alpha: hard cutout with {fringe:,} minimal VP9 rounding pixels "
          f"({100 * fringe / len(alphas):.4f}%).")


def main() -> None:
    for variant in VARIANTS:
        source = ASSETS / f"{variant}-screen-frame.mp4"
        target = ASSETS / f"{variant}-screen-cutout.webm"
        a = probe(source)["stream"]
        b = probe(target, count_frames=True)["stream"]
        original_count = int(a["nb_frames"])
        loop_count = int(b["nb_read_frames"])
        old = rgb_frames(source, (0, 1, original_count-2, original_count-1))
        new = rgb_frames(target, (0, 1, loop_count-2, loop_count-1), vp9=True)
        orig_seam = distance(old[-1], old[0])
        loop_seam = distance(new[-1], new[0])
        normal = (distance(new[0], new[1]) + distance(new[-2], new[-1])) / 2
        print(f"{variant}%: source seam {orig_seam:.3f}; loop seam {loop_seam:.3f}; "
              f"normal motion {normal:.3f}; jump reduction "
              f"{(1 - loop_seam / orig_seam)*100:.1f}%")
        if loop_seam >= orig_seam:
            raise ValueError(f"{variant}%: the new seam did not improve")
        verify_alpha(target)


if __name__ == "__main__":
    main()
