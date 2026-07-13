"""
review_server.py — local, stdlib-only human-in-the-loop review UI.

Launched automatically by sprite_slicer.py when any assets were flagged
(suspicious merges, overlapping boxes, or the 'uncertain' category). Serves:

  GET  /                      -> review.html (canvas box editor)
  GET  /metadata.json         -> current metadata
  GET  /sheet/<name>          -> the original source sheet image
  GET  /asset/<cat>/<file>    -> an already-exported crop (for thumbnails)
  POST /save                  -> body: full updated metadata list.
                                  Re-crops every entry from its source sheet
                                  (so hand-adjusted boxes get real pixels,
                                  not a stretched export), rewrites
                                  metadata.json, the contact sheet, and the
                                  zip package.

No third-party dependencies: only Python's http.server + sprite_slicer's own
alpha-keying/export helpers.
"""

from __future__ import annotations

import json
import mimetypes
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

from PIL import Image

import sprite_slicer as ss

_STATE: dict = {}


def _recrop_entry(entry: dict) -> None:
    """Re-export a single asset from its source sheet using the hand-adjusted
    box, keeping the same border-flood-fill alpha keying (no smoothing)."""
    sheet_path = _STATE["input_dir"] / entry["source_sheet"]
    rgba = ss.load_and_key(sheet_path)
    h, w = rgba.shape[:2]

    x0 = max(0, int(entry["x"]))
    y0 = max(0, int(entry["y"]))
    x1 = min(w - 1, x0 + int(entry["width"]) - 1)
    y1 = min(h - 1, y0 + int(entry["height"]) - 1)
    crop = rgba[y0:y1 + 1, x0:x1 + 1].copy()

    old_category = entry.get("_old_category")
    if old_category and old_category != entry["category"]:
        old_path = _STATE["output_dir"] / old_category / entry["filename"]
        if old_path.exists():
            old_path.unlink()

    cat_dir = _STATE["output_dir"] / entry["category"]
    cat_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(crop, mode="RGBA").save(cat_dir / entry["filename"])


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # keep the console quiet; errors still raise

    def _send(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = unquote(self.path.split("?")[0])
        output_dir: Path = _STATE["output_dir"]
        input_dir: Path = _STATE["input_dir"]

        if path == "/":
            html_path = Path(__file__).parent / "review.html"
            self._send(200, "text/html; charset=utf-8", html_path.read_bytes())
        elif path == "/metadata.json":
            self._send(200, "application/json", (output_dir / "metadata.json").read_bytes())
        elif path == "/sheets.json":
            self._send(200, "application/json", json.dumps(_STATE["sheets"]).encode())
        elif path.startswith("/sheet/"):
            name = path[len("/sheet/"):]
            fp = input_dir / name
            if fp.exists():
                mime = mimetypes.guess_type(fp.name)[0] or "application/octet-stream"
                self._send(200, mime, fp.read_bytes())
            else:
                self._send(404, "text/plain", b"not found")
        elif path.startswith("/asset/"):
            rest = path[len("/asset/"):]
            fp = output_dir / rest
            if fp.exists():
                self._send(200, "image/png", fp.read_bytes())
            else:
                self._send(404, "text/plain", b"not found")
        else:
            self._send(404, "text/plain", b"not found")

    def do_POST(self):
        if self.path != "/save":
            self._send(404, "text/plain", b"not found")
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        entries = json.loads(body)

        for entry in entries:
            _recrop_entry(entry)
            entry.pop("_old_category", None)

        output_dir: Path = _STATE["output_dir"]
        (output_dir / "metadata.json").write_text(json.dumps(entries, indent=2))
        ss.build_contact_sheet(entries, output_dir, output_dir / "preview_contact_sheet.png")
        zip_path = output_dir.parent / _STATE["zip_name"]
        ss.make_zip(output_dir, zip_path)

        self._send(200, "application/json", b'{"ok": true}')


def run_server(output_dir: Path, sheet_names: list[str], input_dir: Path, port: int = 8765,
               zip_name: str = "game-assets.zip") -> None:
    _STATE["output_dir"] = output_dir
    _STATE["input_dir"] = input_dir
    _STATE["sheets"] = sheet_names
    _STATE["zip_name"] = zip_name

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"
    print(f"Review UI running at {url} (Ctrl+C to stop and finish)")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nReview server stopped.")


if __name__ == "__main__":
    import sys
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("game-assets")
    inp = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")
    names = [p.name for p in inp.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg")]
    run_server(out, names, inp)
