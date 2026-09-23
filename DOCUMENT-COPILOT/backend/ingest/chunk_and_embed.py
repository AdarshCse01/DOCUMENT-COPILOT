"""chunk_and_embed.py — CLI orchestrator for chunking HTML filings and storing
vector embeddings in the Supabase document_chunks table.

Usage (from backend/ directory):
    # Dry-run: chunk + token stats, no DB writes, no OpenAI calls
    uv run python -m ingest.chunk_and_embed --dry-run

    # Single-accession smoke test (safe: 1 filing, 1 chunk, real API)
    uv run python -m ingest.chunk_and_embed --accession 0000320193-24-000123 --max-chunks 1

    # Skip already-ingested, ingest everything else
    uv run python -m ingest.chunk_and_embed --skip-existing

    # Force-overwrite all (re-ingestion)
    uv run python -m ingest.chunk_and_embed --force

    # Filter by ticker
    uv run python -m ingest.chunk_and_embed --ticker AAPL --skip-existing
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database.models.document_chunk import DocumentChunk
from app.database.models.source_document import SourceDocument
from app.database.session import SessionLocal
from app.retrieval.embeddings import EmbeddingClient
from ingest.chunking import ChunkingPipeline

# ── Ensure UTF-8 console output on Windows ────────────────────────────────────
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ── Paths ──────────────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_DATA_DIR = _BACKEND_DIR.parent / "data"
_DOWNLOADS_DIR = _DATA_DIR / "downloads"
_DOWNLOADS_MANIFEST = _DOWNLOADS_DIR / "manifest.json"


# ── Manifest helpers ───────────────────────────────────────────────────────────

def load_manifest() -> list[dict[str, Any]]:
    if not _DOWNLOADS_MANIFEST.exists():
        raise FileNotFoundError(f"Manifest not found: {_DOWNLOADS_MANIFEST}")
    return json.loads(_DOWNLOADS_MANIFEST.read_text(encoding="utf-8"))["filings"]


def html_path_for(filing: dict[str, Any]) -> Path:
    rel = filing["local_path"].replace("\\", "/")
    return _DOWNLOADS_DIR / rel


# ── DB helpers ─────────────────────────────────────────────────────────────────

def get_source_doc(accession: str) -> SourceDocument | None:
    with SessionLocal() as s:
        return s.scalars(
            select(SourceDocument).where(SourceDocument.accession_number == accession)
        ).first()


def existing_chunk_count(doc_id: uuid.UUID) -> int:
    with SessionLocal() as s:
        return s.scalar(
            select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == doc_id)
        ) or 0


def delete_chunks(doc_id: uuid.UUID) -> None:
    with SessionLocal() as s:
        s.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc_id))
        s.commit()


def insert_chunks(rows: list[dict[str, Any]]) -> None:
    with SessionLocal() as s:
        s.execute(pg_insert(DocumentChunk).values(rows))
        s.commit()


# ── Dry-run ────────────────────────────────────────────────────────────────────

def run_dry_run(
    filings: list[dict[str, Any]],
    strategy: str,
    max_tokens: int,
) -> None:
    print("=" * 72)
    print(f"DRY RUN | strategy={strategy} | max_tokens={max_tokens} | filings={len(filings)}")
    print("=" * 72)

    pipeline = ChunkingPipeline(strategy=strategy, max_tokens=max_tokens)  # type: ignore[arg-type]
    grand_chunks = 0
    grand_tokens = 0

    for i, filing in enumerate(filings, 1):
        path = html_path_for(filing)
        if not path.exists():
            print(f"[{i:>2}/{len(filings)}] SKIP (no file): {path.name}")
            continue

        chunks = pipeline.chunk_html_file(path, doc_metadata={"ticker": filing["ticker"]})
        tokens = [c.token_count for c in chunks]
        n = len(chunks)
        grand_chunks += n
        grand_tokens += sum(tokens)

        print(
            f"[{i:>2}/{len(filings)}] {filing['ticker']:<5} | "
            f"chunks={n:>4} | tokens: avg={sum(tokens)//n if n else 0:>3} "
            f"min={min(tokens) if tokens else 0:>3} max={max(tokens) if tokens else 0:>4} | "
            f"{path.name}"
        )

    print("-" * 72)
    print(f"TOTAL: {len(filings)} filings | {grand_chunks} chunks | {grand_tokens} tokens")


# ── Main ingestion ─────────────────────────────────────────────────────────────

def ingest_filing(
    filing: dict[str, Any],
    pipeline: ChunkingPipeline,
    embedder: EmbeddingClient,
    skip_existing: bool,
    force: bool,
    max_chunks: int | None,
) -> str:
    """
    Returns one of: "skipped", "inserted", "error"
    """
    accession = filing["accession_number"]
    ticker = filing["ticker"]
    path = html_path_for(filing)

    if not path.exists():
        return "error: file not found"

    source_doc = get_source_doc(accession)
    if not source_doc:
        return "error: source_document not in DB (run seed_source_documents first)"

    # Skip / force logic
    existing = existing_chunk_count(source_doc.id)
    if existing > 0:
        if skip_existing:
            return f"skipped ({existing} chunks already in DB)"
        if not force:
            return f"skipped ({existing} chunks already in DB — use --force to overwrite)"

    # Chunk
    doc_meta = {
        "ticker": ticker,
        "form": filing.get("form", "10-K"),
        "year": source_doc.year,
        "accession_number": accession,
    }
    chunks = pipeline.chunk_html_file(path, doc_metadata=doc_meta)
    if not chunks:
        return "error: chunker produced 0 chunks"

    if max_chunks is not None:
        chunks = chunks[:max_chunks]

    # Embed
    texts = [c.content for c in chunks]
    embeddings = embedder.embed_batch(texts)

    # Build DB rows
    rows = [
        {
            "id": uuid.uuid4(),
            "document_id": source_doc.id,
            "chunk_index": c.chunk_index,
            "page": c.page,
            "section": c.section,
            "content": c.content,
            "token_count": c.token_count,
            "embedding": emb,
            "metadata_json": c.metadata_json,
        }
        for c, emb in zip(chunks, embeddings, strict=True)
    ]

    # Delete old chunks then insert
    if existing > 0:
        delete_chunks(source_doc.id)
    insert_chunks(rows)

    return f"inserted {len(rows)} chunks"


def run_ingest(
    filings: list[dict[str, Any]],
    strategy: str,
    max_tokens: int,
    batch_size: int,
    skip_existing: bool,
    force: bool,
    max_chunks: int | None,
) -> None:
    mode = "SKIP-EXISTING" if skip_existing else ("FORCE-OVERWRITE" if force else "NORMAL")
    print("=" * 72)
    print(f"INGESTION | strategy={strategy} | max_tokens={max_tokens} | mode={mode}")
    print("=" * 72)

    pipeline = ChunkingPipeline(
        strategy=strategy,  # type: ignore[arg-type]
        max_tokens=max_tokens,
    )
    embedder = EmbeddingClient()

    for i, filing in enumerate(filings, 1):
        ticker = filing["ticker"]
        accession = filing["accession_number"]
        label = f"[{i:>2}/{len(filings)}] {ticker:<5} ({accession})"

        try:
            result = ingest_filing(
                filing=filing,
                pipeline=pipeline,
                embedder=embedder,
                skip_existing=skip_existing,
                force=force,
                max_chunks=max_chunks,
            )
            prefix = "SKIP" if result.startswith("skipped") else ("ERR" if result.startswith("error") else "OK")
            print(f"{label} — {prefix}: {result}")
        except Exception as exc:
            print(f"{label} — FAILED: {exc}", file=sys.stderr)

    print("=" * 72)
    print("Done.")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Chunk SEC 10-K HTML filings and embed them into Supabase."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chunk only — print stats, no OpenAI calls, no DB writes.",
    )
    parser.add_argument(
        "--strategy",
        choices=["hybrid", "hierarchical"],
        default="hybrid",
        help="Docling chunking strategy (default: hybrid).",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=800,
        help="Target max tokens per chunk (default: 800).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="OpenAI embedding API batch size (default: 100).",
    )
    parser.add_argument(
        "--ticker",
        type=str,
        default=None,
        help="Filter filings to a single ticker (e.g. AAPL).",
    )
    parser.add_argument(
        "--accession",
        type=str,
        default=None,
        help="Process a single filing by accession number.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip filings that already have chunks in document_chunks.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete existing chunks for each filing before re-ingesting.",
    )
    parser.add_argument(
        "--max-chunks",
        type=int,
        default=None,
        help="Limit to first N chunks per filing (useful for smoke tests).",
    )
    args = parser.parse_args()

    filings = load_manifest()

    if args.accession:
        filings = [f for f in filings if f["accession_number"] == args.accession]
        if not filings:
            print(f"No filing found with accession: {args.accession}", file=sys.stderr)
            sys.exit(1)
    elif args.ticker:
        filings = [f for f in filings if f["ticker"].upper() == args.ticker.upper()]
        if not filings:
            print(f"No filings found for ticker: {args.ticker}", file=sys.stderr)
            sys.exit(1)

    if args.dry_run:
        run_dry_run(filings=filings, strategy=args.strategy, max_tokens=args.max_tokens)
        return

    run_ingest(
        filings=filings,
        strategy=args.strategy,
        max_tokens=args.max_tokens,
        batch_size=args.batch_size,
        skip_existing=args.skip_existing,
        force=args.force,
        max_chunks=args.max_chunks,
    )


if __name__ == "__main__":
    main()
