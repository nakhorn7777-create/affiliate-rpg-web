# Sprite Slicer

Slices pixel-art sprite sheets (with a faux-transparency checkerboard or flat
backdrop) into individual, true-alpha, 1:1-pixel PNG assets, auto-sorted into
`player / npc / enemies / bosses / props / ui`, plus a contact sheet,
`metadata.json`, and `game-assets.zip`.

## Setup

```
cd tools/sprite-slicer
python -m venv .venv
.venv\Scripts\activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Usage

1. Save each sprite sheet as a `.png` (or `.jpg`) into one input folder, e.g.
   `tools/sprite-slicer/input/`.
2. Run:
   ```
   python sprite_slicer.py input -o game-assets
   ```
3. Output lands in `tools/sprite-slicer/game-assets/<category>/*.png`, with
   `game-assets/metadata.json`, `game-assets/preview_contact_sheet.png`, and
   `tools/sprite-slicer/game-assets.zip` alongside it.

If anything looked ambiguous (a merge that bridged two different sprites,
overlapping boxes, or anything dropped in `uncertain`), the script prints a
count and auto-opens a local review page at `http://127.0.0.1:8765/` where
you can drag box corners/bodies, reassign categories, delete false
positives, or draw a missed box — then click **Save & re-export**, which
re-crops straight from the source sheet (never from the exported PNG) so
edited boxes still get real, unsmoothed pixels.

Force the review UI open regardless: `python sprite_slicer.py input --review`
Skip it even if things are flagged: `python sprite_slicer.py input --no-review-server`

## How it works (and why)

- **Background removal**: rather than trying to measure the checkerboard's
  tile period (fragile — tile size varies between sheets), the script samples
  the dominant color(s) touching the image border, then flood-fills *only
  the border-connected region* that matches those colors. This keys out the
  entire background regardless of its tile size while leaving same-colored
  pixels that are enclosed inside a sprite (e.g. a white glove) untouched.
  Matching is exact/tolerance-based (no blending), so edges stay crisp.
- **Grouping without destroying or merging sprites**: a dilated *copy* of the
  foreground mask is used only to decide which raw blobs are "the same
  object" (bridging a 1-3px gap between a body and its weapon/cape/shadow).
  The exported crop always comes from the original, non-dilated pixels, so
  the 6px padding never contains "grown" fake pixels. If a merge looks
  suspicious (the merged box is much bigger than its parts), or two boxes
  end up overlapping, the item is flagged and surfaced in the review UI
  instead of being silently exported.
- **Classification**: sheets in this project are laid out in horizontal rows
  (a pose family, a monster type, a UI icon strip, a tileset row, etc.), so
  components are grouped into row-bands first, then each band is classified
  once using its aggregate size / aspect ratio / fill ratio / hue variance.
  This is a heuristic, not ML — it will get some rows wrong, which is exactly
  what the review UI is for.

## Files

- `sprite_slicer.py` — the pipeline (background keying, segmentation,
  classification, export, contact sheet, zip). Tunable constants live at the
  top of the file.
- `review_server.py` — stdlib-only local HTTP server backing the review UI.
- `review.html` — the canvas-based box editor served by the review server.
