"""Seed source_documents from the local markdown corpus.

Usage (from the backend/ directory):
    uv run python -m ingest.seed_source_documents

The script is idempotent: it uses accession_number as the unique key and
updates the markdown content if a row already exists, so it is safe to run
multiple times.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database.models.source_document import SourceDocument
from app.database.session import SessionLocal

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_DATA_MARKDOWN_DIR = _BACKEND_DIR.parent / "data" / "markdown"
_MANIFEST_PATH = _DATA_MARKDOWN_DIR / "manifest.json"

# Map ticker → canonical company name
_COMPANY_NAMES: dict[str, str] = {
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "NVDA": "NVIDIA Corporation",
    "AMZN": "Amazon.com, Inc.",
    "GOOGL": "Alphabet Inc.",
}


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _load_manifest() -> list[dict]:
    with _MANIFEST_PATH.open(encoding="utf-8") as fh:
        data = json.load(fh)
    return data["filings"]


def _read_markdown(local_path_str: str) -> str:
    # local_path uses backslashes on Windows; normalise to Path
    local_path = Path(local_path_str.replace("\\", "/"))
    full_path = _DATA_MARKDOWN_DIR / local_path
    if not full_path.exists():
        raise FileNotFoundError(f"Markdown file not found: {full_path}")
    return full_path.read_text(encoding="utf-8")


def main() -> None:
    filings = _load_manifest()
    print(f"Found {len(filings)} filings in manifest.")

    rows: list[dict] = []
    for filing in filings:
        ticker = filing["ticker"]
        local_path = filing["local_path"]

        try:
            markdown = _read_markdown(local_path)
        except FileNotFoundError as exc:
            print(f"  SKIP  {local_path} — {exc}", file=sys.stderr)
            continue

        # Derive fiscal year from report_date (fall back to filing_date year)
        report_date_str: str | None = filing.get("report_date")
        filing_date_str: str = filing["filing_date"]
        report_date = _parse_date(report_date_str) if report_date_str else None
        filing_date = _parse_date(filing_date_str)
        year = (report_date or filing_date).year

        rows.append(
            {
                "ticker": ticker,
                "company": _COMPANY_NAMES.get(ticker, ticker),
                "form": filing["form"],
                "filing_date": filing_date,
                "report_date": report_date,
                "year": year,
                "accession_number": filing["accession_number"],
                "source_url": filing["source_url"],
                "markdown": markdown,
            }
        )

    if not rows:
        print("No rows to insert. Exiting.")
        return

    print(f"Inserting / updating {len(rows)} source documents …")

    with SessionLocal() as session:
        stmt = (
            pg_insert(SourceDocument)
            .values(rows)
            .on_conflict_do_update(
                index_elements=["accession_number"],
                set_={
                    "markdown": pg_insert(SourceDocument).excluded.markdown,
                    "source_url": pg_insert(SourceDocument).excluded.source_url,
                    "report_date": pg_insert(SourceDocument).excluded.report_date,
                    "year": pg_insert(SourceDocument).excluded.year,
                },
            )
        )
        session.execute(stmt)
        session.commit()

    print(f"Done. {len(rows)} source document(s) seeded successfully.")


if __name__ == "__main__":
    main()
