"""Ingest Markdown filings into document_chunks with Docling and OpenAI embeddings.

Usage (from backend/ directory):
    # Dry-run: inspect chunking without calling OpenAI or writing to DB
    uv run python -m ingest.ingest_chunks --dry-run --ticker AAPL

    # Single-chunk verification test (calls OpenAI for 1 chunk, inserts to Supabase, verifies SQL):
    uv run python -m ingest.ingest_chunks --test-one-chunk --ticker AAPL

    # Full corpus ingestion:
    uv run python -m ingest.ingest_chunks --strategy hybrid
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select

from app.database.models.document_chunk import DocumentChunk
from app.database.models.source_document import SourceDocument
from app.database.session import SessionLocal
from ingest.chunker import DocumentChunkingPipeline
from ingest.embedder import EmbeddingClient

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_DATA_MARKDOWN_DIR = _BACKEND_DIR.parent / "data" / "markdown"
_MANIFEST_PATH = _DATA_MARKDOWN_DIR / "manifest.json"


def load_manifest() -> list[dict[str, Any]]:
    if not _MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Manifest not found: {_MANIFEST_PATH}")
    with _MANIFEST_PATH.open(encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("filings", [])


def get_source_document_by_accession(accession_number: str) -> SourceDocument | None:
    with SessionLocal() as session:
        return session.scalars(
            select(SourceDocument).where(SourceDocument.accession_number == accession_number)
        ).first()


def run_single_chunk_test(
    filing: dict[str, Any],
    strategy: str = "hybrid",
    max_tokens: int = 800,
    use_mock: bool = False,
) -> bool:
    """Chunks 1 filing, embeds ONLY the first chunk, inserts into Supabase, and verifies."""
    print("=" * 70)
    print("🧪 SINGLE-CHUNK VERIFICATION TEST")
    print("=" * 70)

    accession = filing["accession_number"]
    ticker = filing["ticker"]
    local_path_rel = filing["local_path"].replace("\\", "/")
    full_path = _DATA_MARKDOWN_DIR / local_path_rel

    print(f"Filing: {ticker} ({accession}) -> {full_path.name}")

    # 1. Fetch matching source_document from Supabase
    source_doc = get_source_document_by_accession(accession)
    if not source_doc:
        print(
            f"❌ SourceDocument with accession {accession} not found in database.",
            file=sys.stderr,
        )
        print("Run `uv run python -m ingest.seed_source_documents` first.", file=sys.stderr)
        return False

    print(f"✓ Found SourceDocument in DB (ID: {source_doc.id})")

    # 2. Chunk the file
    print(f"Chunking filing with Docling ({strategy} chunker, max_tokens={max_tokens}) ...")
    pipeline = DocumentChunkingPipeline(
        strategy=strategy,  # type: ignore[arg-type]
        max_tokens=max_tokens,
    )
    chunks = pipeline.chunk_markdown_file(
        full_path,
        doc_metadata={
            "ticker": ticker,
            "form": filing.get("form", "10-K"),
            "year": source_doc.year,
            "accession_number": accession,
        },
    )

    if not chunks:
        print("❌ Chunker produced 0 chunks!", file=sys.stderr)
        return False

    first_chunk = chunks[0]
    print(f"✓ Total chunks produced: {len(chunks)}")
    print(f"✓ Selected Chunk #0: {first_chunk.token_count} tokens")
    print("-" * 50)
    print("Preview Chunk Content (first 250 chars):")
    print(first_chunk.content[:250])
    print("-" * 50)

    # 3. Embed ONLY this 1 chunk
    mode_str = "Mock Generator (zero-cost)" if use_mock else "OpenAI API"
    print(f"Generating vector embedding via {mode_str} for Chunk #0 ...")
    embedder = EmbeddingClient(use_mock=use_mock)
    embedding = embedder.embed_text(first_chunk.content)
    print(f"✓ Returned embedding vector (dimensions: {len(embedding)})")

    # 4. Insert chunk into Supabase
    print("Inserting test chunk into Supabase `document_chunks` table ...")
    test_chunk_id = uuid.uuid4()
    with SessionLocal() as session:
        # Clear any existing chunk for this document at index 0 to avoid duplicates
        session.execute(
            delete(DocumentChunk).where(
                DocumentChunk.document_id == source_doc.id,
                DocumentChunk.chunk_index == first_chunk.chunk_index,
            )
        )

        db_chunk = DocumentChunk(
            id=test_chunk_id,
            document_id=source_doc.id,
            chunk_index=first_chunk.chunk_index,
            page=first_chunk.page,
            section=first_chunk.section,
            content=first_chunk.content,
            token_count=first_chunk.token_count,
            embedding=embedding,
            metadata_json=first_chunk.metadata_json,
        )
        session.add(db_chunk)
        session.commit()

    print(f"✓ Chunk inserted into DB with ID: {test_chunk_id}")

    # 5. Verify chunk in Supabase
    print("Verifying inserted chunk in Supabase via SQL ...")
    with SessionLocal() as session:
        verified = session.get(DocumentChunk, test_chunk_id)
        if not verified:
            print("❌ Verification failed: Chunk not found in DB after commit!", file=sys.stderr)
            return False

        print(f"✓ Verification confirmed: ID={verified.id}")
        print(f"✓ Document ID: {verified.document_id}")
        print(f"✓ Chunk Index: {verified.chunk_index}")
        print(f"✓ Token Count: {verified.token_count}")
        print(f"✓ Embedding vector length: {len(verified.embedding) if verified.embedding else None}")
        print(f"✓ Postgres search_vector generated: {verified.search_vector is not None}")
        print(f"✓ Metadata: {verified.metadata_json}")

    print("=" * 70)
    print("🎉 SINGLE-CHUNK VERIFICATION TEST PASSED SUCCESSFULLY!")
    print("=" * 70)
    return True


def run_dry_run(
    filings: list[dict[str, Any]],
    strategy: str = "hybrid",
    max_tokens: int = 800,
) -> None:
    """Chunks filings and outputs statistics without calling OpenAI or writing to DB."""
    print("=" * 70)
    print("🔍 DRY RUN CHUNKING INSPECTION")
    print(f"Strategy: {strategy} | Max tokens: {max_tokens} | Filings count: {len(filings)}")
    print("=" * 70)

    pipeline = DocumentChunkingPipeline(
        strategy=strategy,  # type: ignore[arg-type]
        max_tokens=max_tokens,
    )

    total_chunks = 0
    total_tokens = 0

    for idx, filing in enumerate(filings, start=1):
        ticker = filing["ticker"]
        local_path_rel = filing["local_path"].replace("\\", "/")
        full_path = _DATA_MARKDOWN_DIR / local_path_rel

        if not full_path.exists():
            print(f"[{idx}/{len(filings)}] SKIP {ticker} — file not found: {full_path}")
            continue

        chunks = pipeline.chunk_markdown_file(
            full_path,
            doc_metadata={"ticker": ticker, "accession_number": filing["accession_number"]},
        )
        counts = len(chunks)
        tokens = [c.token_count for c in chunks]
        doc_tokens = sum(tokens)
        min_tok = min(tokens) if tokens else 0
        max_tok = max(tokens) if tokens else 0
        avg_tok = doc_tokens // counts if counts else 0

        total_chunks += counts
        total_tokens += doc_tokens

        print(
            f"[{idx:>2}/{len(filings)}] {ticker:<5} | Chunks: {counts:>4} | "
            f"Tokens: {doc_tokens:>6} (avg: {avg_tok:>3}, min: {min_tok:>3}, max: {max_tok:>4}) | "
            f"File: {full_path.name}"
        )

    print("-" * 70)
    print(f"Total Filings: {len(filings)} | Total Chunks: {total_chunks} | Total Tokens: {total_tokens}")
    print("=" * 70)


def ingest_all(
    filings: list[dict[str, Any]],
    strategy: str = "hybrid",
    max_tokens: int = 800,
    batch_size: int = 100,
    use_mock: bool = False,
) -> None:
    """Performs full ingestion of chunks and embeddings into Supabase."""
    print("=" * 70)
    print("🚀 FULL INGESTION PIPELINE")
    mode_desc = "MOCK EMBEDDINGS (offline test)" if use_mock else "LIVE OPENAI API"
    print(f"Strategy: {strategy} | Max tokens: {max_tokens} | Batch size: {batch_size} | Mode: {mode_desc}")
    print("=" * 70)

    pipeline = DocumentChunkingPipeline(
        strategy=strategy,  # type: ignore[arg-type]
        max_tokens=max_tokens,
    )
    embedder = EmbeddingClient(use_mock=use_mock)

    total_inserted = 0

    for idx, filing in enumerate(filings, start=1):
        ticker = filing["ticker"]
        accession = filing["accession_number"]
        local_path_rel = filing["local_path"].replace("\\", "/")
        full_path = _DATA_MARKDOWN_DIR / local_path_rel

        source_doc = get_source_document_by_accession(accession)
        if not source_doc:
            print(f"[{idx}/{len(filings)}] SKIP {ticker} ({accession}) — not in source_documents")
            continue

        print(f"[{idx}/{len(filings)}] Processing {ticker} ({accession}) ...")
        chunks = pipeline.chunk_markdown_file(
            full_path,
            doc_metadata={
                "ticker": ticker,
                "form": filing.get("form", "10-K"),
                "year": source_doc.year,
                "accession_number": accession,
            },
        )

        if not chunks:
            print(f"  No chunks produced for {ticker}.")
            continue

        print(f"  Generated {len(chunks)} chunks. Generating embeddings ...")
        texts = [c.content for c in chunks]
        embeddings = embedder.embed_batch(texts, batch_size=batch_size)

        db_rows: list[DocumentChunk] = []
        for c, emb in zip(chunks, embeddings, strict=True):
            db_rows.append(
                DocumentChunk(
                    id=uuid.uuid4(),
                    document_id=source_doc.id,
                    chunk_index=c.chunk_index,
                    page=c.page,
                    section=c.section,
                    content=c.content,
                    token_count=c.token_count,
                    embedding=emb,
                    metadata_json=c.metadata_json,
                )
            )

        with SessionLocal() as session:
            # Idempotently remove any prior chunks for this document
            session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == source_doc.id))
            session.add_all(db_rows)
            session.commit()

        total_inserted += len(db_rows)
        print(f"  ✓ Inserted {len(db_rows)} chunks into Supabase.")

    print("=" * 70)
    print(f"✅ Ingestion complete! Total chunks inserted: {total_inserted}")
    print("=" * 70)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Docling chunks and embeddings into Supabase")
    parser.add_argument(
        "--test-one-chunk",
        action="store_true",
        help="Embed only 1 chunk, insert to Supabase, and verify SQL results",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect chunks and token stats without calling OpenAI or writing to DB",
    )
    parser.add_argument(
        "--strategy",
        choices=["hybrid", "hierarchical"],
        default="hybrid",
        help="Docling chunking strategy (default: hybrid)",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=800,
        help="Maximum tokens per chunk for hybrid chunker (default: 800)",
    )
    parser.add_argument(
        "--ticker",
        type=str,
        default=None,
        help="Filter filings by ticker (e.g. AAPL, MSFT, NVDA)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for OpenAI embeddings (default: 100)",
    )
    parser.add_argument(
        "--mock-embeddings",
        action="store_true",
        help="Generate synthetic 1536-dim normalized vectors without calling OpenAI API (zero-cost DB testing)",
    )
    args = parser.parse_args()

    filings = load_manifest()
    if args.ticker:
        filings = [f for f in filings if f.get("ticker", "").upper() == args.ticker.upper()]
        if not filings:
            print(f"No filings found for ticker: {args.ticker}", file=sys.stderr)
            sys.exit(1)

    if args.test_one_chunk:
        success = run_single_chunk_test(
            filing=filings[0],
            strategy=args.strategy,
            max_tokens=args.max_tokens,
            use_mock=args.mock_embeddings,
        )
        sys.exit(0 if success else 1)

    if args.dry_run:
        run_dry_run(filings=filings, strategy=args.strategy, max_tokens=args.max_tokens)
        return

    ingest_all(
        filings=filings,
        strategy=args.strategy,
        max_tokens=args.max_tokens,
        batch_size=args.batch_size,
        use_mock=args.mock_embeddings,
    )


if __name__ == "__main__":
    main()
