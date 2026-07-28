"""Resize/compress real 360° source photos into web-ready panoramas for the tour.

Usage (from repo root):
    python scripts/media/build_panoramas.py
    python scripts/media/build_panoramas.py --source "D:\\some\\other\\folder"

Reads a fixed 5-folder layout (entrance, ground floor, first floor,
seccond floor, third floor — folder names/numbering are the user's source of
truth and are never renamed), and for every numbered photo writes a resized
primary JPEG + a small preview JPEG (for blur-up loading) under
frontend/public/panoramas/main-building/{floor-slug}/, plus a manifest.json
consumed by scripts/db/seed.py. Source files are only ever read, never
modified/renamed/reordered. Safe to re-run — output is fully regenerated
each time from the source folder.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
from pathlib import Path
from typing import TypedDict

from PIL import Image, ImageOps

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(message)s")
logger = logging.getLogger("build_panoramas")

DEFAULT_SOURCE = Path(r"C:\Users\harsh\Desktop\campus photos\main building")
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "frontend" / "public" / "panoramas" / "main-building"

PRIMARY_WIDTH = 4096
PRIMARY_QUALITY = 82
PREVIEW_WIDTH = 960
PREVIEW_QUALITY = 60

# (source folder name under DEFAULT_SOURCE, floor slug, floor level, display name)
# Order here is the walking/floor order — level 0 is the lowest.
FLOORS = [
    ("entrance", "entrance", 0, "Entrance"),
    ("ground floor", "ground-floor", 1, "Ground Floor"),
    ("first floor", "first-floor", 2, "First Floor"),
    ("seccond floor", "second-floor", 3, "Second Floor"),
    ("third floor", "third-floor", 4, "Third Floor"),
]

NUMERIC_STEM = re.compile(r"(\d+)")


class SceneManifestEntry(TypedDict):
    index: int
    filename: str
    primary: str
    preview: str
    width: int
    height: int


class FloorManifestEntry(TypedDict):
    slug: str
    level: int
    name: str
    scenes: list[SceneManifestEntry]


def _numbered_photos(folder: Path) -> list[Path]:
    photos = [p for p in folder.iterdir() if p.suffix.lower() in (".jpg", ".jpeg")]

    def sort_key(p: Path) -> int:
        match = NUMERIC_STEM.search(p.stem)
        return int(match.group(1)) if match else 0

    return sorted(photos, key=sort_key)


def _resize_keep_aspect(image: Image.Image, target_width: int) -> Image.Image:
    ratio = target_width / image.width
    target_height = round(image.height * ratio)
    return image.resize((target_width, target_height), Image.Resampling.LANCZOS)


def _process_photo(source_path: Path, dest_dir: Path) -> SceneManifestEntry:
    with Image.open(source_path) as raw:
        # Correct orientation per EXIF *before* we discard EXIF below —
        # otherwise stripping it first can leave sideways/upside-down output.
        oriented = ImageOps.exif_transpose(raw)
        rgb = oriented.convert("RGB") if oriented.mode != "RGB" else oriented

        primary = _resize_keep_aspect(rgb, PRIMARY_WIDTH)
        preview = _resize_keep_aspect(rgb, PREVIEW_WIDTH)

    dest_dir.mkdir(parents=True, exist_ok=True)
    stem = source_path.stem
    primary_name = f"{stem}.jpg"
    preview_name = f"{stem}-preview.jpg"

    primary.save(
        dest_dir / primary_name,
        format="JPEG",
        quality=PRIMARY_QUALITY,
        optimize=True,
        progressive=True,
    )
    preview.save(
        dest_dir / preview_name,
        format="JPEG",
        quality=PREVIEW_QUALITY,
        optimize=True,
        progressive=True,
    )

    match = NUMERIC_STEM.search(stem)
    index = int(match.group(1)) if match else 0

    return SceneManifestEntry(
        index=index,
        filename=source_path.name,
        primary=f"/panoramas/main-building/{dest_dir.name}/{primary_name}",
        preview=f"/panoramas/main-building/{dest_dir.name}/{preview_name}",
        width=primary.width,
        height=primary.height,
    )


def build(source_root: Path, output_root: Path) -> dict:
    floors: list[FloorManifestEntry] = []
    total = 0

    for folder_name, slug, level, display_name in FLOORS:
        source_folder = source_root / folder_name
        if not source_folder.is_dir():
            logger.warning("Skipping missing floor folder: %s", source_folder)
            continue

        photos = _numbered_photos(source_folder)
        if not photos:
            logger.warning("No photos found in %s", source_folder)
            continue

        dest_dir = output_root / slug
        scenes: list[SceneManifestEntry] = []
        for photo in photos:
            scenes.append(_process_photo(photo, dest_dir))
            total += 1

        logger.info("Processed %d photos for floor '%s' (%s)", len(scenes), display_name, slug)
        floors.append(FloorManifestEntry(slug=slug, level=level, name=display_name, scenes=scenes))

    manifest = {
        "building": "Main Building",
        "buildingCode": "MAIN",
        "floors": floors,
    }

    output_root.mkdir(parents=True, exist_ok=True)
    manifest_path = output_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    logger.info("Wrote manifest with %d total scenes to %s", total, manifest_path)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    if not args.source.is_dir():
        raise SystemExit(f"Source folder not found: {args.source}")

    build(args.source, args.output)


if __name__ == "__main__":
    main()
