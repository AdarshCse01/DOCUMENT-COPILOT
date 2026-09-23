# /// script
# requires-python = ">=3.12"
# dependencies = ["docling"]
# ///
"""
convert_to_markdown.py -- Convert downloaded SEC 10-K HTML filings to Markdown.

Usage (from the repo root):
    uv run data/convert_to_markdown.py

What it does:
  1. Reads data/downloads/manifest.json to get the list of all 25 filings.
  2. For each filing converts:
       data/downloads/<year>/<filename>.htm
     ->
       data/markdown/<year>/<filename>.md
     using Docling DocumentConverter (HTML -> clean Markdown).
  3. Skips files that have already been converted (idempotent re-runs are safe).
  4. Writes data/markdown/manifest.json -- a copy of the original manifest with
     local_path updated to point at the new .md files.

Folder structure preserved:
    data/
    |- downloads/
    |   |- manifest.json
    |   |- 2021/  aapl_...htm  msft_...htm  ...
    |   |- 2022/  ...
    |   ...
    +- markdown/          <- created by this script
        |- manifest.json
        |- 2021/  aapl_...md  msft_...md  ...
        |- 2022/  ...
        ...
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths (all relative to this script -- sits in the data/ folder)
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent
DOWNLOADS_DIR = DATA_DIR / "downloads"
MARKDOWN_DIR = DATA_DIR / "markdown"
MANIFEST_IN = DOWNLOADS_DIR / "manifest.json"
MANIFEST_OUT = MARKDOWN_DIR / "manifest.json"


def convert_filings() -> None:
    # ------------------------------------------------------------------
    # 1. Validate inputs
    # ------------------------------------------------------------------
    if not MANIFEST_IN.exists():
        print(f"[ERROR] Manifest not found: {MANIFEST_IN}", file=sys.stderr)
        print("        Run `uv run data/download.py` first.", file=sys.stderr)
        sys.exit(1)

    manifest = json.loads(MANIFEST_IN.read_text(encoding="utf-8"))
    filings = manifest.get("filings", [])
    if not filings:
        print("[ERROR] manifest.json contains no filings.", file=sys.stderr)
        sys.exit(1)

    # ------------------------------------------------------------------
    # 2. Lazy-import Docling (heavy -- models may download on first use)
    # ------------------------------------------------------------------
    print("Loading Docling converter... (may take a moment on first run)")
    from docling.document_converter import DocumentConverter

    converter = DocumentConverter()

    # ------------------------------------------------------------------
    # 3. Convert each filing
    # ------------------------------------------------------------------
    MARKDOWN_DIR.mkdir(parents=True, exist_ok=True)

    updated_filings: list[dict] = []
    total = len(filings)
    skipped = 0
    converted = 0
    failed = 0

    for idx, filing in enumerate(filings, start=1):
        raw_local_path: str = filing["local_path"]
        # Normalise Windows back-slashes that may appear in manifest
        html_rel = Path(raw_local_path.replace("\\", "/"))
        html_path = DOWNLOADS_DIR / html_rel

        # Mirror the same relative path under markdown/ but with .md extension
        md_rel = html_rel.with_suffix(".md")
        md_path = MARKDOWN_DIR / md_rel

        ticker = filing.get("ticker", "?")
        year = html_rel.parts[0]  # first path component is always the year

        prefix = f"[{idx:>2}/{total}] {ticker} {year}"

        if not html_path.exists():
            print(f"{prefix}  WARNING  source not found, skipping: {html_path}")
            failed += 1
            updated_filings.append({**filing, "local_path": str(md_rel)})
            continue

        if md_path.exists():
            print(f"{prefix}  OK  already converted, skipping")
            skipped += 1
            updated_filings.append({**filing, "local_path": str(md_rel)})
            continue

        # Ensure the year sub-folder exists under markdown/
        md_path.parent.mkdir(parents=True, exist_ok=True)

        print(f"{prefix}  ->  converting {html_path.name} ...", end="", flush=True)
        t0 = time.perf_counter()

        try:
            result = converter.convert(str(html_path))
            markdown_text = result.document.export_to_markdown()
            md_path.write_text(markdown_text, encoding="utf-8")
            elapsed = time.perf_counter() - t0
            size_kb = md_path.stat().st_size / 1024
            print(f"  done  ({elapsed:.1f}s, {size_kb:.0f} KB)")
            converted += 1
        except Exception as exc:
            elapsed = time.perf_counter() - t0
            print(f"  FAILED ({elapsed:.1f}s): {exc}")
            failed += 1

        updated_filings.append({**filing, "local_path": str(md_rel)})

    # ------------------------------------------------------------------
    # 4. Write data/markdown/manifest.json
    # ------------------------------------------------------------------
    md_manifest = {
        **manifest,
        "markdown_converted_count": converted + skipped,
        "filings": updated_filings,
    }
    MANIFEST_OUT.write_text(
        json.dumps(md_manifest, indent=2) + "\n", encoding="utf-8"
    )

    # ------------------------------------------------------------------
    # 5. Summary
    # ------------------------------------------------------------------
    print()
    print("=" * 60)
    print(f"  Converted : {converted}")
    print(f"  Skipped   : {skipped}  (already done)")
    print(f"  Failed    : {failed}")
    print(f"  Output dir: {MARKDOWN_DIR}")
    print(f"  Manifest  : {MANIFEST_OUT}")
    print("=" * 60)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    convert_filings()
