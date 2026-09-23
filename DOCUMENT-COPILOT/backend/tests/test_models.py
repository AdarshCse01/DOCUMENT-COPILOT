import uuid
from datetime import date

from app.database.models import (
    Base,
    ChatMessage,
    ChatThread,
    DocumentChunk,
    MessageCitation,
    SourceDocument,
    User,
)


def test_metadata_contains_all_tables():
    expected_tables = {
        "users",
        "chat_threads",
        "chat_messages",
        "source_documents",
        "document_chunks",
        "message_citations",
    }
    assert expected_tables.issubset(set(Base.metadata.tables.keys()))


def test_foreign_key_relationships():
    # chat_threads -> users
    thread_fks = {
        fk.target_fullname for fk in Base.metadata.tables["chat_threads"].foreign_keys
    }
    assert "users.id" in thread_fks

    # chat_messages -> chat_threads
    message_fks = {
        fk.target_fullname for fk in Base.metadata.tables["chat_messages"].foreign_keys
    }
    assert "chat_threads.id" in message_fks

    # document_chunks -> source_documents
    chunk_fks = {
        fk.target_fullname
        for fk in Base.metadata.tables["document_chunks"].foreign_keys
    }
    assert "source_documents.id" in chunk_fks

    # message_citations -> chat_messages & document_chunks
    citation_fks = {
        fk.target_fullname
        for fk in Base.metadata.tables["message_citations"].foreign_keys
    }
    assert "chat_messages.id" in citation_fks
    assert "document_chunks.id" in citation_fks


def test_model_instantiation():
    user_id = uuid.uuid4()
    user = User(id=user_id, email="analyst@driftwood.com")
    assert user.id == user_id
    assert user.email == "analyst@driftwood.com"

    thread = ChatThread(user_id=user.id, title="Apple Q4 Analysis")
    assert thread.title == "Apple Q4 Analysis"

    message = ChatMessage(
        thread_id=thread.id,
        role="assistant",
        content="Apple revenue grew 8% YoY.",
        parts=[{"type": "text", "text": "Apple revenue grew 8% YoY."}],
    )
    assert message.role == "assistant"
    assert message.parts[0]["type"] == "text"

    doc = SourceDocument(
        ticker="AAPL",
        company="Apple Inc.",
        form="10-K",
        filing_date=date(2024, 10, 31),
        year=2024,
        accession_number="0000320193-24-000106",
        source_url="https://sec.gov/Archives/edgar/data/320193/...",
        markdown="# Apple 10-K Filing",
    )
    assert doc.ticker == "AAPL"
    assert doc.year == 2024

    chunk = DocumentChunk(
        document_id=doc.id,
        chunk_index=0,
        page=12,
        section="Item 7. MD&A",
        content="Total net sales increased 8%...",
        embedding=[0.01] * 1536,
        token_count=120,
        metadata_json={"ticker": "AAPL", "year": 2024},
    )
    assert chunk.page == 12
    assert len(chunk.embedding) == 1536

    citation = MessageCitation(
        message_id=message.id,
        chunk_id=chunk.id,
        ticker="AAPL",
        company="Apple Inc.",
        form="10-K",
        filing_date=date(2024, 10, 31),
        year=2024,
        accession_number="0000320193-24-000106",
        page=12,
        section="Item 7. MD&A",
        source_url="https://sec.gov/Archives/edgar/data/320193/...",
        excerpt="Total net sales increased 8%...",
    )
    assert citation.ticker == "AAPL"
    assert citation.page == 12
