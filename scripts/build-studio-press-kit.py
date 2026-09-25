#!/usr/bin/env python3
"""Build the curated public SigilForge Studios press-kit ZIP."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "studio/press/downloads/sigilforge-studios-press-kit.zip"  # date-neutral, stable URL

FILES = {
    "studio/press/copy/press-kit-readme.txt": "README.txt",
    "studio/press/copy/boilerplate-short.txt": "Boilerplate/boilerplate-short.txt",
    "studio/press/copy/boilerplate-medium.txt": "Boilerplate/boilerplate-medium.txt",
    "studio/press/copy/boilerplate-long.txt": "Boilerplate/boilerplate-long.txt",
    "studio/press/copy/founder-bio-short.txt": "Founder/founder-bio-short.txt",
    "studio/press/copy/founder-bio-long.txt": "Founder/founder-bio-long.txt",
    "studio/press/media/founder.png": "Founder/founder-portrait.png",
    # Primary horizontal lockup (PNG master from the canonical SigilForge shelf + web derivative).
    "studio/assets/brand/sigilforge-banner-lockup-wide.png": "SigilForge-Studios/sigilforge-lockup-wide.png",
    "studio/assets/brand/sigilforge-banner-lockup-wide.webp": "SigilForge-Studios/sigilforge-lockup-wide.webp",
    "studio/assets/brand/sigilforge-emblem.png": "SigilForge-Studios/sigilforge-shield-emblem.png",
    "studio/assets/brand/sigilforge-banner-primary.webp": "SigilForge-Studios/sigilforge-banner-primary.webp",
    "studio/assets/brand/sigilforge-studios-emblem-transparent.png": "SigilForge-Studios/sigilforge-studios-emblem-transparent.png",
    "studio/assets/brand/sigilforge-studios-emblem-transparent.webp": "SigilForge-Studios/sigilforge-studios-emblem-transparent.webp",
    "studio/assets/brand/sigilforge-studios-emblem.png": "SigilForge-Studios/Sources/sigilforge-studios-emblem-source.png",
    "studio/assets/brand/sigilforge-branded-round-badge.webp": "SigilForge-Studios/sigilforge-branded-round-badge-solid.webp",
    "studio/assets/brand/sigilforge-branded-round-badge-nobg.webp": "SigilForge-Studios/sigilforge-branded-round-badge-transparent.webp",
    "studio/press/media/sigilforge-brand-board.webp": "SigilForge-Studios/sigilforge-brand-board.webp",
    "studio/press/media/software-veildaemon.webp": "VeilDaemon/veildaemon-live-platform.webp",
    "studio/assets/social/data-room-operations-vault-og.jpg": "VeilDaemon/technology-social-preview.jpg",
    "studio/press/media/product-operator-core.webp": "Products/operator-core.webp",
    "studio/press/media/product-handler-core.webp": "Products/handler-core.webp",
    "studio/press/media/product-viridian.webp": "Products/needlepoint-viridian-house.webp",
    "studio/assets/site-hd/studio-hero-cathedral-hd.webp": "Studio-Plates/studio-hero-cathedral.webp",
    "studio/assets/site-hd/studio-publishing-hero-hd.webp": "Studio-Plates/publishing-line.webp",
    # Canonical SigilForge favicon set (Marketing/SigilForge Art/Favicon/ in the Cradlepoint repo).
    **{f"studio/assets/brand/{name}": f"SigilForge-Studios/Favicons/{name}" for name in (
        "favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "favicon-48x48.png",
        "apple-touch-icon.png", "sigilforge-mark-192.png", "sigilforge-mark-512.png",
    )},
    "studio/press/media/witness-key-badge.png": "VeilCorp-In-Universe/witness-key-badge.png",
    "studio/press/media/logo-primary.png": "VeilCorp-In-Universe/veilcorp-primary.png",
    "studio/press/media/logo-simple.png": "VeilCorp-In-Universe/veilcorp-simple.png",
    "studio/press/media/avatar.png": "VeilCorp-In-Universe/veilcorp-avatar.png",
    "studio/press/copy/approved-captions.txt": "Guidance/approved-captions.txt",
    "studio/press/copy/usage-guidance.txt": "Guidance/media-usage-guidance.txt",
}


def main() -> None:
    destinations = list(FILES.values())
    duplicates = sorted({d for d in destinations if destinations.count(d) > 1})
    if duplicates:
        raise SystemExit("Duplicate press-kit destinations: " + ", ".join(duplicates))
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
