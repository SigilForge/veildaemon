#!/usr/bin/env python3
"""Build the curated public Cradlepoint Studio press-kit ZIP."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "studio/press/downloads/cradlepoint-studio-press-kit-july-2026.zip"

FILES = {
    "studio/press/copy/press-kit-readme.txt": "README.txt",
    "studio/press/copy/boilerplate-short.txt": "Boilerplate/boilerplate-short.txt",
    "studio/press/copy/boilerplate-medium.txt": "Boilerplate/boilerplate-medium.txt",
    "studio/press/copy/boilerplate-long.txt": "Boilerplate/boilerplate-long.txt",
    "studio/press/copy/founder-bio-short.txt": "Founder/founder-bio-short.txt",
    "studio/press/copy/founder-bio-long.txt": "Founder/founder-bio-long.txt",
    "studio/press/media/founder.png": "Founder/founder-portrait.png",
    "studio/assets/brand/cradlepoint-studio-wordmark-color.png": "Cradlepoint-Studio/cradlepoint-studio-wordmark-color.png",
    "studio/assets/brand/cradlepoint-studio-wordmark-color.webp": "Cradlepoint-Studio/cradlepoint-studio-wordmark-color.webp",
    "studio/assets/brand/cradlepoint-studio-wordmark-monochrome.png": "Cradlepoint-Studio/cradlepoint-studio-wordmark-monochrome.png",
    "studio/assets/brand/cradlepoint-studio-emblem-transparent.png": "Cradlepoint-Studio/cradlepoint-studio-emblem-transparent.png",
    "studio/assets/brand/cradlepoint-studio-emblem-transparent.webp": "Cradlepoint-Studio/cradlepoint-studio-emblem-transparent.webp",
    "studio/assets/brand/cradlepoint-studio-emblem.png": "Cradlepoint-Studio/Sources/cradlepoint-studio-emblem-source.png",
    "studio/assets/brand/cradlepoint-studio-seal-city-duality-transparent.png": "Cradlepoint-Studio/cradlepoint-studio-seal-city-duality-transparent.png",
    "studio/assets/brand/cradlepoint-studio-seal-city-duality-transparent.webp": "Cradlepoint-Studio/cradlepoint-studio-seal-city-duality-transparent.webp",
    "studio/assets/brand/cradlepoint-studio-seal-city-duality.png": "Cradlepoint-Studio/Sources/cradlepoint-studio-seal-city-duality-source.png",
    "studio/press/media/software-veildaemon.webp": "VeilDaemon/veildaemon-live-platform.webp",
    "studio/assets/social/technology-social-preview.jpg": "VeilDaemon/technology-social-preview.jpg",
    "studio/press/media/product-operator-core.webp": "Products/operator-core.webp",
    "studio/press/media/product-handler-core.webp": "Products/handler-core.webp",
    "studio/press/media/product-viridian.webp": "Products/needlepoint-viridian-house.webp",
    "studio/assets/site-hd/studio-hero-cathedral-hd.webp": "Studio-Plates/studio-hero-cathedral.webp",
    "studio/assets/site-hd/studio-publishing-hero-hd.webp": "Studio-Plates/publishing-line.webp",
    "studio/press/media/logo-primary.png": "VeilCorp-In-Universe/veilcorp-primary.png",
    "studio/press/media/logo-simple.png": "VeilCorp-In-Universe/veilcorp-simple.png",
    "studio/press/media/avatar.png": "VeilCorp-In-Universe/veilcorp-avatar.png",
    "studio/press/copy/approved-captions.txt": "Guidance/approved-captions.txt",
    "studio/press/copy/usage-guidance.txt": "Guidance/media-usage-guidance.txt",
}


def main() -> None:
    missing = [source for source in FILES if not (ROOT / source).is_file()]
    if missing:
        raise SystemExit("Missing press-kit sources: " + ", ".join(missing))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    with ZipFile(temporary, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for source, destination in FILES.items():
            archive.write(ROOT / source, destination)
    temporary.replace(OUTPUT)
    print(f"Built {OUTPUT.relative_to(ROOT)} with {len(FILES)} files")


if __name__ == "__main__":
    main()
