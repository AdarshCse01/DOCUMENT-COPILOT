from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field


class CitationItem(BaseModel):
    """Structured citation referencing a specific retrieved filing chunk."""

    chunk_id: uuid.UUID = Field(
        description="UUID of the chunk that supports the claim"
    )
    ticker: str = Field(description="Company ticker symbol (e.g. AAPL, AMZN, MSFT)")
    company: str = Field(description="Company name")
    form: str = Field(description="Filing form type, e.g. 10-K or 10-Q")
    filing_date: date = Field(description="Date the filing was submitted")
    year: int | None = Field(default=None, description="Fiscal year of the filing")
    accession_number: str | None = Field(
        default=None, description="SEC accession number"
    )
    page: int | None = Field(
        default=None, description="Page number of the chunk if available"
    )
    section: str | None = Field(
        default=None, description="Section heading or item name"
    )
    source_url: str | None = Field(
        default=None, description="URL to the source document if available"
    )
    excerpt: str = Field(
        description="Exact verbatim sentence or phrase from the chunk text backing the claim"
    )


class GroundedAnswer(BaseModel):
    """Product contract: grounded answer accompanied by strictly verifiable citations."""

    answer: str = Field(
        description="The synthesised analyst-grade response, citing facts directly."
    )
    citations: list[CitationItem] = Field(
        default_factory=list,
        description="Citations supporting every factual assertion in the answer.",
    )
    insufficient_evidence: bool = Field(
        default=False,
        description="True if the corpus lacks sufficient evidence to answer the query.",
    )
