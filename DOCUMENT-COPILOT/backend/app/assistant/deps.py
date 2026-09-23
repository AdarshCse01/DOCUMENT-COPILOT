from __future__ import annotations

import contextlib
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from app.database.models.document_chunk import DocumentChunk
from app.retrieval.retriever import DocumentRetriever
from app.retrieval.types import RetrievedPassage


def chunk_to_passage(chunk: DocumentChunk) -> RetrievedPassage:
    """Convert a database DocumentChunk and related SourceDocument into a RetrievedPassage."""
    doc = getattr(chunk, "document", None)
    return RetrievedPassage(
        chunk_id=chunk.id,
        document_id=chunk.document_id,
        chunk_index=chunk.chunk_index,
        text=chunk.content,
        page=chunk.page,
        section=chunk.section,
        fusion_score=0.0,
        ticker=doc.ticker if doc else "UNKNOWN",
        company_name=doc.company if doc else None,
        form=doc.form if doc else "10-K",
        filing_date=doc.filing_date if doc else date(2024, 1, 1),
        fiscal_year=doc.year if doc else None,
        accession_number=doc.accession_number if doc else "",
    )


class TurnRegistry:
    """In-memory registry holding all RetrievedPassage records fetched during the active turn."""

    def __init__(self) -> None:
        self.passages: dict[uuid.UUID, RetrievedPassage] = {}

    def register(self, passage: RetrievedPassage | DocumentChunk) -> RetrievedPassage:
        if hasattr(passage, "content"):
            p = chunk_to_passage(passage)
        else:
            p = passage
        self.passages[p.chunk_id] = p
        return p

    def get(self, chunk_id: uuid.UUID) -> RetrievedPassage | None:
        return self.passages.get(chunk_id)

    def all(self) -> list[RetrievedPassage]:
        return list(self.passages.values())

    def __contains__(self, chunk_id: uuid.UUID) -> bool:
        return chunk_id in self.passages

    def __getitem__(self, chunk_id: uuid.UUID) -> RetrievedPassage:
        return self.passages[chunk_id]

    def __len__(self) -> int:
        return len(self.passages)


@dataclass
class DocumentAgentDeps:
    """Runtime dependencies provided to the PydanticAI document agent."""

    user_id: uuid.UUID
    thread_id: uuid.UUID
    session: Session
    retriever: DocumentRetriever
    registry: TurnRegistry = field(default_factory=TurnRegistry)
    on_status: Callable[[str], Awaitable[None]] | None = None

    async def emit_status(self, message: str) -> None:
        """Emit a pipeline status update if a callback is registered."""
        if self.on_status is not None:
            with contextlib.suppress(Exception):
                await self.on_status(message)

    @property
    def retrieved_passages(self) -> dict[uuid.UUID, RetrievedPassage]:
        """Backwards compatibility accessor for retrieved passages dictionary."""
        return self.registry.passages
