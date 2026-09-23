import uuid
from datetime import date
from unittest.mock import MagicMock

import pytest

from app.assistant.agent import (
    DocumentAgentDeps,
    read_chunk,
    read_surrounding_chunks,
    search_filings,
)
from app.database.models.document_chunk import DocumentChunk
from app.database.models.source_document import SourceDocument


@pytest.fixture
def mock_deps() -> DocumentAgentDeps:
    mock_retriever = MagicMock()
    mock_session = MagicMock()
    return DocumentAgentDeps(
        user_id=uuid.uuid4(),
        thread_id=uuid.uuid4(),
        session=mock_session,
        retriever=mock_retriever,
    )


def make_mock_chunk(
    chunk_id: uuid.UUID | None = None,
    content: str = "Test chunk content",
    index: int = 0,
) -> DocumentChunk:
    cid = chunk_id or uuid.uuid4()
    doc = SourceDocument(
        id=uuid.uuid4(),
        ticker="NVDA",
        company="NVIDIA Corporation",
        form="10-K",
        filing_date=date(2024, 2, 21),
        year=2024,
        accession_number="0001045810-24-000029",
    )
    chunk = DocumentChunk(
        id=cid,
        document_id=doc.id,
        chunk_index=index,
        content=content,
        page=15,
        section="Item 7",
    )
    chunk.document = doc
    return chunk


import asyncio


def test_search_filings_populates_retrieved_passages(mock_deps: DocumentAgentDeps) -> None:
    async def _run():
        chunk1 = make_mock_chunk(content="Data Center compute revenue grew 217%.")
        mock_deps.retriever.search.return_value = [chunk1]

        mock_ctx = MagicMock()
        mock_ctx.deps = mock_deps

        result = await search_filings(mock_ctx, query="NVIDIA Data Center", ticker="NVDA", year=2024)

        assert "Data Center compute revenue grew 217%" in result
        assert chunk1.id in mock_deps.retrieved_passages
        passage = mock_deps.retrieved_passages[chunk1.id]
        assert passage.ticker == "NVDA"
        assert passage.company_name == "NVIDIA Corporation"

    asyncio.run(_run())


def test_read_chunk_populates_retrieved_passages(mock_deps: DocumentAgentDeps) -> None:
    async def _run():
        chunk1 = make_mock_chunk(content="Detailed risk factor disclosure.")

        mock_ctx = MagicMock()
        mock_ctx.deps = mock_deps

        from unittest.mock import patch
        with patch("app.assistant.agent.get_chunk_by_id", return_value=chunk1):
            result = await read_chunk(mock_ctx, str(chunk1.id))

        assert "Detailed risk factor disclosure" in result
        assert chunk1.id in mock_deps.retrieved_passages

    asyncio.run(_run())


def test_read_surrounding_chunks(mock_deps: DocumentAgentDeps) -> None:
    async def _run():
        chunk_prev = make_mock_chunk(content="Previous paragraph context.", index=1)
        chunk_target = make_mock_chunk(content="Target paragraph context.", index=2)
        chunk_next = make_mock_chunk(content="Next paragraph context.", index=3)

        mock_ctx = MagicMock()
        mock_ctx.deps = mock_deps

        from unittest.mock import patch
        with patch(
            "app.assistant.agent.get_surrounding_chunks",
            return_value=[chunk_prev, chunk_target, chunk_next],
        ):
            result = await read_surrounding_chunks(mock_ctx, str(chunk_target.id), window=1)

        assert "Previous paragraph context" in result
        assert "Target paragraph context" in result
        assert "Next paragraph context" in result
        assert len(mock_deps.retrieved_passages) == 3

    asyncio.run(_run())

