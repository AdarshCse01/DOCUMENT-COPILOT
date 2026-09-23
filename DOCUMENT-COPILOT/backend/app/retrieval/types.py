from datetime import date
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

MAX_PASSAGE_EXCERPT_CHARS = 800
MAX_AGENT_OUTPUT_CHARS = 12_000

class SearchFilters(BaseModel):
    ticker: str | None = None
    fiscal_years: list[int] | None = None
    form: str | None = None

class RankedChunkHit(BaseModel):
    chunk_id: UUID
    rank: int
    score: float | None = None

class RetrievedPassage(BaseModel):
    chunk_id: UUID
    document_id: UUID
    chunk_index: int
    text: str
    page: int | None
    section: str | None
    fusion_score: float
    ticker: str
    company_name: str | None
    form: str
    filing_date: date
    fiscal_year: int | None
    accession_number: str
    neighbors: list['RetrievedPassage'] = Field(default_factory=list)


def format_passages_for_agent(passages: list[RetrievedPassage | Any]) -> str:
    """Format retrieved passages into readable text blocks for agent or debugging."""
    if not passages:
        return "No passages found."

    blocks = []
    for idx, p in enumerate(passages, start=1):
        if hasattr(p, "content"):  # DocumentChunk
            doc = getattr(p, "document", None)
            ticker = getattr(doc, "ticker", "UNKNOWN") if doc else "UNKNOWN"
            form = getattr(doc, "form", "10-K") if doc else "10-K"
            year = f" FY{doc.year}" if doc and getattr(doc, "year", None) else ""
            page = f" p.{p.page}" if p.page is not None else ""
            sec = f" [{p.section}]" if p.section else ""
            blocks.append(
                f"[{idx}] {ticker} {form}{year}{sec}{page}\n"
                f"Chunk ID: {p.id}\n"
                f"{p.content.strip()}"
            )
        else:  # RetrievedPassage
            year = f" FY{p.fiscal_year}" if getattr(p, "fiscal_year", None) else ""
            page = f" p.{p.page}" if getattr(p, "page", None) is not None else ""
            sec = f" [{p.section}]" if getattr(p, "section", None) else ""
            cid = getattr(p, "chunk_id", "")
            text = getattr(p, "text", "")
            blocks.append(
                f"[{idx}] {p.ticker} {p.form}{year}{sec}{page}\n"
                f"Chunk ID: {cid}\n"
                f"{text.strip()}"
            )

    return "\n\n".join(blocks)

