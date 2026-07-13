#!/usr/bin/env python3
"""
sprite_slicer.py — Slice pixel-art sprite sheets into individual, transparent,
1:1-pixel game assets.

Pipeline:
  1. Load each sheet, detect the faux-transparency checkerboard / flat backdrop
     by sampling border colors, then flood-fill *from the border inward* so
     only background actually connected to the edges is keyed out. Pixels
     inside a character that happen to share a background color are left
     alone because they are not reachable from the border.
  2. Build a foreground mask, mildly dilate a COPY of it (never the pixels
     themselves) to bridge tiny anti-aliasing gaps between a body and an
     adjacent accessory (weapon, cape, floating effect, shadow), then label
     connected components on that dilated copy. Each pixel's final
     component id is read back from the dilated label image, but the actual
     crop is always computed from the ORIGINAL undilated pixels, so no
     dilated/grown pixels ever leak into an exported asset.
  3. Group components into horizontal "row bands" (sheets in this project are
     laid out in rows: a pose family, a monster type, a UI icon strip, etc.)
     and classify each band with size / aspect / fill-ratio / palette-variance
     heuristics into player / npc / enemies / bosses / props / ui / uncertain.
  4. Crop tight to true pixel edges, pad 6px transparent on all sides, save.
  5. Emit a dark contact-sheet PNG, metadata.json, and game-assets.zip.
  6. Anything ambiguous (suspected bad merges, `uncertain` category, or boxes
     that overlap) is flagged; if anything was flagged, a local review server
     is offered so a human can drag-correct boxes before the final export.

Dependencies: Pillow, OpenCV (opencv-python), numpy (an OpenCV dependency).
Everything else used (json, zipfile, argparse, statistics, pathlib) is
Python's standard library.
"""

from __future__ import annotations

import argparse
import json
import shutil
import statistics
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# --------------------------------------------------------------------------
# Tunable constants — all classification/merge behaviour lives here so it can
# be adjusted without touching the pipeline logic.
# --------------------------------------------------------------------------

PNG_BG_TOLERANCE = 10         # per-channel flood-fill step tolerance for lossless sheets
JPEG_BG_TOLERANCE = 26        # looser: JPEG compression drifts the checkerboard's colors

MERGE_DILATION_PX = 3         # radius used only to decide adjacency, never applied to pixels
ACCESSORY_AREA_RATIO = 0.35   # smallest/largest raw-blob area above this -> comparable sizes -> flag

MIN_COMPONENT_AREA = 20       # opaque-pixel components smaller than this are discarded as noise
PADDING = 6                   # required transparent padding on every side

ROW_MIN_GUTTER_PX = 4         # a blank-pixel-row gap smaller than this is treated as noise, not a real row break

BOSS_SCALE_FACTOR = 1.6       # band median dim this many x the sheet-wide median -> bosses
UI_MAX_DIM = 70               # max(w,h) at/under this can be a small solid ui icon
UI_MIN_FILL = 0.35            # icons/bars are a clear graphic, not a sparse silhouette
ELONGATED_ASPECT_LOW = 0.5    # avg_aspect at/below this reads as a vertical bar/button -> ui
ELONGATED_ASPECT_HIGH = 2.0   # avg_aspect at/above this reads as a horizontal bar/button -> ui
PROPS_MIN_FILL = 0.85         # near-solid rectangle (tile/texture/swatch/furniture)
SIDE_EDGE_FILL_THRESHOLD = 0.2  # both left+right bbox edge columns this opaque -> a flat panel, not a silhouette
PROPS_MAX_DIM = 170
ENEMY_MIN_DIM = 90            # below this a filled blob is just as likely a UI/portrait icon
ENEMY_MIN_FILL = 0.4          # a blobby creature is reasonably filled, unlike a sparse fx/particle
HUMANOID_ASPECT_LOW = 0.28    # w/h band-average within this range reads as an upright character
HUMANOID_ASPECT_HIGH = 0.95
PLAYER_HUE_STD_THRESHOLD = 9.0  # low hue variance across a band = one recolored character family
MIN_PLAYER_BAND_COUNT = 3

CATEGORIES = ["player", "npc", "enemies", "bosses", "props", "ui", "uncertain"]

CONTACT_SHEET_BG = (24, 24, 28)
CONTACT_SHEET_CELL = 140
CONTACT_SHEET_COLS = 10


@dataclass
class Component:
    label: int
    ys: np.ndarray
    xs: np.ndarray
    x0: int
    y0: int
    x1: int
    y1: int
    needs_review: bool = False
    review_reason: str = ""
    source_sheet: str = ""
    category: str = ""
    filename: str = ""

    @property
    def w(self) -> int:
        return self.x1 - self.x0 + 1

    @property
    def h(self) -> int:
        return self.y1 - self.y0 + 1

    @property
    def area(self) -> int:
        return len(self.xs)

    @property
    def fill_ratio(self) -> float:
        return self.area / max(1, self.w * self.h)

    @property
    def aspect(self) -> float:
        return self.w / max(1, self.h)


# --------------------------------------------------------------------------
# 1. Background detection + alpha keying
# --------------------------------------------------------------------------

def build_alpha_mask(rgb: np.ndarray, tolerance: int) -> np.ndarray:
    """True where a pixel is part of the background, found by flood-filling
    inward from every border pixel.

    A single global color-key (match pixel color to one fixed reference
    within a tolerance) breaks down on JPEG-compressed sheets: compression
    drifts the checkerboard's colors gradually and unevenly across the
    image, so a tile far from the border can fall outside a fixed-color
    tolerance even though it's clearly still background. Flood fill instead
    compares each newly-absorbed pixel to its *already-absorbed neighbor*,
    so it tolerates gradual drift the same way a "magic wand" tool does,
    while a real sprite's edge still stops the fill because the color jump
    there is sharp, not gradual. Background is still whatever is reachable
    from the border, so same-colored pixels enclosed inside a sprite are
    left alone. The output alpha is still hard 0/255 — no blending.
    """
    h, w = rgb.shape[:2]
    flood_mask = np.zeros((h + 2, w + 2), np.uint8)
    work = rgb.copy()
    diff = (tolerance, tolerance, tolerance)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)

    border_points = (
        [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
        + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    )
    for x, y in border_points:
        if flood_mask[y + 1, x + 1] == 0:
            cv2.floodFill(work, flood_mask, (x, y), 0, loDiff=diff, upDiff=diff, flags=flags)

    return flood_mask[1:-1, 1:-1] > 0  # True = background, to be made transparent


def load_and_key(path: Path) -> np.ndarray:
    """Return an RGBA numpy array with true alpha, no smoothing/aliasing."""
    img = Image.open(path).convert("RGB")
    rgb = np.array(img)
    tolerance = JPEG_BG_TOLERANCE if path.suffix.lower() in (".jpg", ".jpeg") else PNG_BG_TOLERANCE
    bg_mask = build_alpha_mask(rgb, tolerance)

    rgba = np.dstack([rgb, np.full(rgb.shape[:2], 255, dtype=np.uint8)])
    rgba[bg_mask, 3] = 0
    return rgba


# --------------------------------------------------------------------------
# 2. Component segmentation (dilate a copy for adjacency only)
# --------------------------------------------------------------------------

def segment_components(rgba: np.ndarray, source_name: str) -> list[Component]:
    alpha = rgba[:, :, 3]
    fg = (alpha > 0).astype(np.uint8)

    _, raw_labels = cv2.connectedComponents(fg, connectivity=8)

    kernel_size = MERGE_DILATION_PX * 2 + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    dilated_fg = cv2.dilate(fg, kernel, iterations=1)
    _, dil_labels = cv2.connectedComponents(dilated_fg, connectivity=8)

    # Map every ORIGINAL foreground pixel to its dilated-component id, then
    # build the component purely from original (non-dilated) coordinates.
    ys, xs = np.nonzero(fg)
    dil_ids = dil_labels[ys, xs]
    raw_ids = raw_labels[ys, xs]

    components: list[Component] = []
    for dil_id in np.unique(dil_ids):
        if dil_id == 0:
            continue
        sel = dil_ids == dil_id
        comp_ys, comp_xs = ys[sel], xs[sel]
        if len(comp_xs) < MIN_COMPONENT_AREA:
            continue
        x0, x1 = int(comp_xs.min()), int(comp_xs.max())
        y0, y1 = int(comp_ys.min()), int(comp_ys.max())

        raw_ids_here = np.unique(raw_ids[sel])
        needs_review = False
        reason = ""
        if len(raw_ids_here) > 1:
            # Multiple originally-separate blobs got bridged by the merge
            # dilation. A tiny floating accessory (speech bubble, "zzz",
            # sparkle, shadow) next to a much bigger body is the expected,
            # desired case and is extremely common across a dense character
            # sheet — flagging every one of those would flood the review
            # queue with non-issues. What's actually suspicious is bridging
            # two blobs of COMPARABLE size, which looks like two distinct
            # sprites standing too close together rather than one entity
            # plus a small accessory.
            raw_areas = sorted(int((raw_labels == rid).sum()) for rid in raw_ids_here)
            if raw_areas[0] / raw_areas[-1] > ACCESSORY_AREA_RATIO:
                needs_review = True
                reason = (f"bridged {len(raw_ids_here)} similarly-sized blobs — "
                          "confirm this is one entity, not two adjacent sprites")

        components.append(Component(
            label=int(dil_id), ys=comp_ys, xs=comp_xs,
            x0=x0, y0=y0, x1=x1, y1=y1,
            needs_review=needs_review, review_reason=reason,
            source_sheet=source_name,
        ))

    # Overlap safety net: if two exported boxes would overlap, flag both
    # rather than silently letting one clip into the other's transparent
    # padding region.
    for i, a in enumerate(components):
        for b in components[i + 1:]:
            if a.x0 <= b.x1 and b.x0 <= a.x1 and a.y0 <= b.y1 and b.y0 <= a.y1:
                a.needs_review = b.needs_review = True
                a.review_reason = b.review_reason = "overlapping bounding boxes"

    return components


# --------------------------------------------------------------------------
# 3. Row-band grouping + classification
# --------------------------------------------------------------------------

def average_hue(rgb_pixels: np.ndarray) -> float:
    hsv = cv2.cvtColor(rgb_pixels.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV)
    return float(hsv[0, :, 0].mean())


def find_row_bands(fg_mask: np.ndarray) -> list[tuple[int, int]]:
    """Find horizontal bands of the sheet that actually contain pixels, using
    the true blank-pixel-row gutters between them (spec point 4: "inspect
    empty pixel valleys between characters"), rather than chaining component
    bounding boxes — a single unusually tall item (e.g. a boss) would
    otherwise drag its bbox's y-range across several unrelated rows below it
    and swallow them into the same band."""
    row_has_fg = fg_mask.any(axis=1)
    h = len(row_has_fg)
    raw_bands: list[list[int]] = []
    y = 0
    while y < h:
        if row_has_fg[y]:
            start = y
            while y < h and row_has_fg[y]:
                y += 1
            raw_bands.append([start, y - 1])
        else:
            y += 1

    bands: list[list[int]] = []
    for b in raw_bands:
        if bands and b[0] - bands[-1][1] - 1 < ROW_MIN_GUTTER_PX:
            bands[-1][1] = b[1]
        else:
            bands.append(b)
    return [(b[0], b[1]) for b in bands]


def group_into_rows(components: list[Component], rgba: np.ndarray) -> list[list[Component]]:
    if not components:
        return []
    fg_mask = rgba[:, :, 3] > 0
    band_ranges = find_row_bands(fg_mask)

    band_map: dict[tuple[int, int], list[Component]] = defaultdict(list)
    for c in components:
        center_y = (c.y0 + c.y1) // 2
        target = min(band_ranges, key=lambda b: 0 if b[0] <= center_y <= b[1] else min(abs(center_y - b[0]), abs(center_y - b[1])))
        band_map[target].append(c)
    return list(band_map.values())


def classify(components: list[Component], rgba: np.ndarray) -> None:
    if not components:
        return
    global_median_dim = statistics.median(max(c.w, c.h) for c in components)
    bands = group_into_rows(components, rgba)

    for band in bands:
        dims = [max(c.w, c.h) for c in band]
        med_dim = statistics.median(dims)
        avg_fill = statistics.mean(c.fill_ratio for c in band)
        avg_aspect = statistics.mean(c.aspect for c in band)

        # Fraction of each component's LEFT and RIGHT bbox edge column that's
        # opaque. A rectangular panel/furniture/background asset is drawn to
        # fill its rectangle, so both side edges are opaque almost top to
        # bottom; a character silhouette tapers in from the shoulders/arms
        # and essentially never keeps both sides opaque along their full
        # height, regardless of aspect ratio.
        side_edge_fills = []
        for c in band:
            left_count = int(np.count_nonzero(c.xs == c.x0))
            right_count = int(np.count_nonzero(c.xs == c.x1))
            side_edge_fills.append(min(left_count, right_count) / c.h)
        avg_side_edge_fill = statistics.mean(side_edge_fills)

        hues = []
        for c in band:
            pixels = rgba[c.ys, c.xs, :3]
            hues.append(average_hue(pixels))
        hue_std = statistics.pstdev(hues) if len(hues) > 1 else 0.0

        # Aspect ratio (is this band shaped like an upright character?) is
        # checked before fill ratio: a densely-drawn robed NPC can be just as
        # "solid" inside its bbox as a flat tile swatch, so fill ratio alone
        # can't tell props apart from characters — but a tile/UI-bar/icon is
        # reliably square-ish or wide, while a character bbox is reliably
        # taller than it is wide.
        is_humanoid_shape = HUMANOID_ASPECT_LOW <= avg_aspect <= HUMANOID_ASPECT_HIGH
        is_elongated = avg_aspect <= ELONGATED_ASPECT_LOW or avg_aspect >= ELONGATED_ASPECT_HIGH
        # Aspect ratio alone can't rule out "flat rectangular object" here —
        # a portrait-oriented locker, vending machine, or full room
        # background is just as "taller than wide" as a character is, and
        # can have a few internal gaps (a window, a lamp) that keep it from
        # ever quite reaching 100% fill either. Requiring solid *and*
        # opaque-to-both-side-edges together is a much more specific
        # signature of "this is a flat panel", since a real character
        # silhouette essentially never satisfies both at once. Checked
        # before both the boss-size and humanoid checks, otherwise a large
        # solid background gets swept into bosses just for being bigger
        # than a character, or a portrait-shaped one gets read as upright.
        looks_like_flat_tile = avg_fill > PROPS_MIN_FILL and avg_side_edge_fill > SIDE_EDGE_FILL_THRESHOLD

        # NOTE on the known blind spot: a compact, moderately-filled,
        # non-humanoid icon (a coin, a small monster portrait, a gear) looks
        # almost identical in size/aspect/fill terms whether it's a UI icon
        # or a small creature — there's no cheap signal here that reliably
        # tells those apart. Rather than flip a coin and be confidently
        # wrong, this classifier is deliberately precision-first: it only
        # commits to a specific category when the shape is distinctive
        # (elongated bar -> ui, near-solid square/wide tile -> props, a
        # clearly bigger organic blob -> enemies) and drops everything else
        # into 'uncertain' for a human to sort in the review UI.
        if looks_like_flat_tile:
            category = "props"  # near-perfectly-solid rectangle: tile/texture/furniture/background, any size
        elif med_dim > global_median_dim * BOSS_SCALE_FACTOR:
            category = "bosses"
        elif is_humanoid_shape:
            if hue_std < PLAYER_HUE_STD_THRESHOLD and len(band) >= MIN_PLAYER_BAND_COUNT:
                category = "player"
            else:
                category = "npc"
        elif avg_fill > PROPS_MIN_FILL:
            category = "props"  # solid-ish but not perfectly so (fence/gate/detailed furniture) and non-humanoid
        elif is_elongated and avg_fill > UI_MIN_FILL:
            category = "ui"  # health/energy bars, buttons, nameplates
        elif med_dim > ENEMY_MIN_DIM and avg_fill > ENEMY_MIN_FILL and med_dim <= PROPS_MAX_DIM:
            category = "enemies"  # a bigger, fairly-filled organic blob
        elif med_dim <= UI_MAX_DIM and avg_fill > UI_MIN_FILL:
            category = "ui"  # small solid icon (coin, gear, badge, ...)
        else:
            category = "uncertain"

        for c in band:
            c.category = category


# --------------------------------------------------------------------------
# 4. Export
# --------------------------------------------------------------------------

def export_component(rgba: np.ndarray, c: Component, out_path: Path) -> tuple[int, int, int, int]:
    h, w = rgba.shape[:2]
    px0 = max(0, c.x0 - PADDING)
    py0 = max(0, c.y0 - PADDING)
    px1 = min(w - 1, c.x1 + PADDING)
    py1 = min(h - 1, c.y1 + PADDING)

    crop = rgba[py0:py1 + 1, px0:px1 + 1].copy()
    Image.fromarray(crop, mode="RGBA").save(out_path)
    return px0, py0, px1 - px0 + 1, py1 - py0 + 1


def build_contact_sheet(entries: list[dict], asset_root: Path, out_path: Path) -> None:
    if not entries:
        return
    rows = (len(entries) + CONTACT_SHEET_COLS - 1) // CONTACT_SHEET_COLS
    sheet_w = CONTACT_SHEET_COLS * CONTACT_SHEET_CELL
    sheet_h = rows * (CONTACT_SHEET_CELL + 18)
    sheet = Image.new("RGB", (sheet_w, sheet_h), CONTACT_SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    for i, entry in enumerate(entries):
        col, row = i % CONTACT_SHEET_COLS, i // CONTACT_SHEET_COLS
        cell_x = col * CONTACT_SHEET_CELL
        cell_y = row * (CONTACT_SHEET_CELL + 18)
        draw.rectangle(
            [cell_x + 4, cell_y + 4, cell_x + CONTACT_SHEET_CELL - 4, cell_y + CONTACT_SHEET_CELL - 4],
            outline=(90, 90, 100),
        )
        asset = Image.open(asset_root / entry["category"] / entry["filename"]).convert("RGBA")
        scale = min((CONTACT_SHEET_CELL - 16) / asset.width, (CONTACT_SHEET_CELL - 16) / asset.height, 1.0)
        thumb = asset.resize((max(1, int(asset.width * scale)), max(1, int(asset.height * scale))), Image.NEAREST)
        px = cell_x + (CONTACT_SHEET_CELL - thumb.width) // 2
        py = cell_y + (CONTACT_SHEET_CELL - thumb.height) // 2 - 6
        sheet.paste(thumb, (px, py), thumb)
        label = entry["filename"].replace(".png", "")
        draw.text((cell_x + 6, cell_y + CONTACT_SHEET_CELL - 10), label, fill=(210, 210, 215), font=font)

    sheet.save(out_path)


def make_zip(output_dir: Path, zip_path: Path) -> None:
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in output_dir.rglob("*"):
            if path.is_file() and path != zip_path:
                zf.write(path, path.relative_to(output_dir))


# --------------------------------------------------------------------------
# Pipeline entry point
# --------------------------------------------------------------------------

def process_sheet(path: Path, output_dir: Path, counters: dict[str, int]) -> list[dict]:
    rgba = load_and_key(path)
    components = segment_components(rgba, path.name)
    classify(components, rgba)

    entries = []
    for c in sorted(components, key=lambda c: (c.y0, c.x0)):
        counters[c.category] = counters.get(c.category, 0) + 1
        prefix = {
            "player": "player", "npc": "npc", "enemies": "enemy",
            "bosses": "boss", "props": "prop", "ui": "ui", "uncertain": "uncertain",
        }[c.category]
        filename = f"{prefix}_{counters[c.category]:03d}.png"
        c.filename = filename

        cat_dir = output_dir / c.category
        cat_dir.mkdir(parents=True, exist_ok=True)
        x, y, w, h = export_component(rgba, c, cat_dir / filename)

        entries.append({
            "filename": filename,
            "category": c.category,
            "x": x, "y": y, "width": w, "height": h,
            "source_sheet": path.name,
            "needs_review": c.needs_review,
            "review_reason": c.review_reason,
        })
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_dir", type=Path, help="Folder containing source sprite sheet PNG/JPG files")
    parser.add_argument("-o", "--output", type=Path, default=Path("game-assets"), help="Output folder")
    parser.add_argument("--zip-name", default="game-assets.zip")
    parser.add_argument("--review", action="store_true", help="Force-launch the review server even if nothing was flagged")
    parser.add_argument("--no-review-server", action="store_true", help="Never auto-launch the review server")
    args = parser.parse_args()

    sheets = sorted([p for p in args.input_dir.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg")])
    if not sheets:
        raise SystemExit(f"No .png/.jpg sprite sheets found in {args.input_dir}")

    if args.output.exists():
        shutil.rmtree(args.output)
    args.output.mkdir(parents=True)
    for cat in CATEGORIES:
        (args.output / cat).mkdir()

    counters: dict[str, int] = {}
    all_entries: list[dict] = []
    flagged = []

    for sheet in sheets:
        print(f"Processing {sheet.name} ...")
        entries = process_sheet(sheet, args.output, counters)
        all_entries.extend(entries)
        flagged.extend([e for e in entries if e["needs_review"]])

    metadata_path = args.output / "metadata.json"
    metadata_path.write_text(json.dumps(all_entries, indent=2))

    build_contact_sheet(all_entries, args.output, args.output / "preview_contact_sheet.png")

    zip_path = args.output.parent / args.zip_name
    make_zip(args.output, zip_path)

    print(f"\nExtracted {len(all_entries)} assets into {args.output}/")
    for cat in CATEGORIES:
        n = counters.get(cat, 0)
        if n:
            print(f"  {cat:10s} {n}")
    print(f"Contact sheet : {args.output / 'preview_contact_sheet.png'}")
    print(f"Metadata      : {metadata_path}")
    print(f"Zip package   : {zip_path}")

    uncertain_count = counters.get("uncertain", 0)
    if flagged or uncertain_count:
        print(f"\n{len(flagged)} asset(s) flagged for review (suspicious merges/overlaps), "
              f"{uncertain_count} in 'uncertain'.")
        if not args.no_review_server:
            print("Launching the review server so you can drag-correct boxes...")
            from review_server import run_server
            run_server(args.output, [s.name for s in sheets], args.input_dir)
    elif args.review:
        from review_server import run_server
        run_server(args.output, [s.name for s in sheets], args.input_dir)
    else:
        print("\nNothing flagged. Run with --review if you want to spot-check anyway.")


if __name__ == "__main__":
    main()
