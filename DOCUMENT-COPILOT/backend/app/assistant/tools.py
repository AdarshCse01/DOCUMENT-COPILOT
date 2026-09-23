"""Agent retrieval tools for Document Copilot."""

from __future__ import annotations

import uuid

from pydantic_ai import RunContext

from app.assistant.deps import DocumentAgentDeps, chunk_to_passage
from app.retrieval.queries import get_chunk_by_id, get_surrounding_chunks
from app.retrieval.types import RetrievedPassage


def format_passage_for_prompt(passage: RetrievedPassage) -> str:
    """Format a single passage with clear metadata for LLM grounding."""
    year_str = f" FY{passage.fiscal_year}" if passage.fiscal_year else ""
    page_str = f" Page {passage.page}" if passage.page is not None else ""
    section_str = f" [{passage.section}]" if passage.section else ""
    return (
        f"--- CHUNK ID: {passage.chunk_id} ---\n"
        f"Company: {passage.company_name or passage.ticker} ({passage.ticker}) | "
        f"Form: {passage.form}{year_str} | Date: {passage.filing_date}{page_str}{section_str}\n"
        f"Content:\n{passage.text.strip()}\n"
    )


async def search_filings_impl(
    ctx: RunContext[DocumentAgentDeps],
    query: str,
    ticker: str | None = None,
    year: int | None = None,
    top_k: int = 5,
) -> str:
    """Search SEC filings across the ingested corpus using hybrid semantic and keyword search."""
    top_k = min(max(1, top_k), 10)
    keywords = ctx.deps.retriever.extract_keywords(query, ticker=ticker)
    print(f"  [AGENT TOOL] search_filings(query={query!r}, ticker={ticker}, year={year}, top_k={top_k})", flush=True)
    print(f"  [AGENT TOOL] Extracted FTS Keywords: {keywords}", flush=True)
    ticker_str = f" for {ticker}" if ticker else ""
    kw_preview = ", ".join(keywords[:3]) if keywords else query
    await ctx.deps.emit_status(f"Searching SEC filings{ticker_str} ({kw_preview})...")
    chunks = ctx.deps.retriever.search(
        query=query,
        ticker=ticker,
        year=year,
        top_k=top_k,
        keywords=keywords,
    )
    print(f"  [AGENT TOOL] search_filings found {len(chunks)} chunks.", flush=True)
    await ctx.deps.emit_status(f"Retrieved {len(chunks)} relevant filing passages. Reading sections...")

    if not chunks:
        return f"No filing chunks found matching query='{query}' (ticker={ticker}, year={year})."

    output_blocks = []
    for chunk in chunks:
        passage = chunk_to_passage(chunk)
        ctx.deps.retrieved_passages[chunk.id] = passage
        output_blocks.append(format_passage_for_prompt(passage))

    return "\n".join(output_blocks)


async def read_chunk_impl(
    ctx: RunContext[DocumentAgentDeps],
    chunk_id: str,
) -> str:
    """Retrieve and read the full text and metadata of a specific chunk by its UUID."""
    print(f"  [AGENT TOOL] read_chunk(chunk_id={chunk_id})", flush=True)
    try:
        chunk_uuid = uuid.UUID(chunk_id)
    except (ValueError, TypeError):
        return f"Invalid chunk UUID format: '{chunk_id}'."

    chunk = get_chunk_by_id(ctx.deps.session, chunk_uuid)
    if not chunk:
        return f"Chunk {chunk_id} not found."

    passage = chunk_to_passage(chunk)
    ctx.deps.retrieved_passages[chunk.id] = passage
    return format_passage_for_prompt(passage)


async def read_surrounding_chunks_impl(
    ctx: RunContext[DocumentAgentDeps],
    chunk_id: str,
    window: int = 1,
) -> str:
    """Read adjacent chunks before and after a given chunk in the same filing for broader context."""
    print(f"  [AGENT TOOL] read_surrounding_chunks(chunk_id={chunk_id}, window={window})", flush=True)
    try:
        chunk_uuid = uuid.UUID(chunk_id)
    except (ValueError, TypeError):
        return f"Invalid chunk UUID format: '{chunk_id}'."

    window = min(max(1, window), 2)
    surrounding = get_surrounding_chunks(ctx.deps.session, chunk_uuid, window=window)
    if not surrounding:
        return f"No surrounding chunks found for chunk {chunk_id}."

    output_blocks = []
    for chunk in surrounding:
        passage = chunk_to_passage(chunk)
        ctx.deps.retrieved_passages[chunk.id] = passage
        output_blocks.append(format_passage_for_prompt(passage))

    return "\n".join(output_blocks)
