from __future__ import annotations

import uuid
from pathlib import Path

from pydantic_ai import Agent, RunContext
from pydantic_ai.settings import ModelSettings

from app.config import settings
from app.retrieval.queries import get_chunk_by_id, get_surrounding_chunks
from app.retrieval.types import RetrievedPassage

INSTRUCTIONS_PATH = Path(__file__).resolve().parent / "instructions.md"
INSTRUCTIONS = (
    INSTRUCTIONS_PATH.read_text(encoding="utf-8")
    if INSTRUCTIONS_PATH.exists()
    else "You are Document Copilot. Ground all answers in SEC filings with citations."
)


from app.assistant.deps import DocumentAgentDeps, chunk_to_passage
from app.assistant.outputs import CitationItem, GroundedAnswer

__all__ = [
    "CitationItem",
    "GroundedAnswer",
    "doc_agent",
    "read_chunk",
    "read_chunks",
    "read_surrounding_chunks",
    "run_document_agent",
    "run_document_agent_sync",
    "search_filings",
]


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


doc_agent: Agent[DocumentAgentDeps, GroundedAnswer] = Agent(
    f"openai:{settings.openai_chat_model}",
    deps_type=DocumentAgentDeps,
    output_type=GroundedAnswer,
    system_prompt=INSTRUCTIONS,
    model_settings=ModelSettings(
        max_tokens=settings.openai_max_tokens,
        temperature=settings.openai_agent_temperature,
    ),
)


@doc_agent.tool
async def search_filings(
    ctx: RunContext[DocumentAgentDeps],
    query: str,
    ticker: str | None = None,
    year: int | None = None,
    top_k: int = 12,
) -> str:
    """Search SEC filings across the ingested corpus using hybrid semantic and keyword search.

    Args:
        query: Specific search terms or natural language query.
        ticker: Optional company ticker filter (e.g. 'AAPL', 'MSFT', 'NVDA').
        year: Optional fiscal year filter (e.g. 2023, 2024).
        top_k: Number of relevant chunks to return (default 12, max 25).
    """
    top_k = min(max(1, top_k), 25)
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


@doc_agent.tool
async def read_chunks(
    ctx: RunContext[DocumentAgentDeps],
    chunk_ids: list[str],
) -> str:
    """Retrieve and read full text and metadata for multiple chunks in one call.

    Args:
        chunk_ids: List of chunk UUID strings to inspect.
    """
    print(f"  [AGENT TOOL] read_chunks(chunk_ids={chunk_ids})", flush=True)
    blocks = []
    for chunk_id in chunk_ids:
        try:
            chunk_uuid = uuid.UUID(chunk_id)
        except (ValueError, TypeError):
            blocks.append(f"Invalid chunk UUID format: '{chunk_id}'.")
            continue

        chunk = get_chunk_by_id(ctx.deps.session, chunk_uuid)
        if not chunk:
            blocks.append(f"Chunk {chunk_id} not found.")
            continue

        passage = chunk_to_passage(chunk)
        ctx.deps.retrieved_passages[chunk.id] = passage
        blocks.append(format_passage_for_prompt(passage))

    return "\n".join(blocks)


@doc_agent.tool
async def read_chunk(
    ctx: RunContext[DocumentAgentDeps],
    chunk_id: str,
) -> str:
    """Retrieve and read the full text and metadata of a specific chunk by its UUID.

    Args:
        chunk_id: The UUID string of the chunk to read.
    """
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


@doc_agent.tool
async def read_surrounding_chunks(
    ctx: RunContext[DocumentAgentDeps],
    chunk_id: str,
    window: int = 1,
) -> str:
    """Read adjacent chunks before and after a given chunk in the same filing for broader context.

    Args:
        chunk_id: The UUID string of the target chunk.
        window: Number of chunks before and after to fetch (default 1, max 2).
    """
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


async def run_document_agent(query: str, deps: DocumentAgentDeps) -> GroundedAnswer:
    """Execute the Document Copilot PydanticAI agent and return the grounded answer."""
    result = await doc_agent.run(query, deps=deps)
    return result.output


def run_document_agent_sync(query: str, deps: DocumentAgentDeps) -> GroundedAnswer:
    """Synchronous execution of Document Copilot agent."""
    result = doc_agent.run_sync(query, deps=deps)
    return result.output

