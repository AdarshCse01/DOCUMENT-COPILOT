import uuid
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.assistant.agent import CitationItem, GroundedAnswer
from app.chat.messages import AISDKMessage
from app.chat.orchestrator import orchestrate_chat_turn
from app.database.base import Base
from app.database.models.chat_message import ChatMessage
from app.database.models.chat_thread import ChatThread
from app.database.models.message_citation import MessageCitation
from app.database.models.user import User
from app.retrieval.types import RetrievedPassage


# Teach SQLite how to compile PostgreSQL JSONB columns for unit testing
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(
        test_engine,
        tables=[
            User.__table__,
            ChatThread.__table__,
            ChatMessage.__table__,
            MessageCitation.__table__,
        ],
    )
    yield
    Base.metadata.drop_all(
        test_engine,
        tables=[
            MessageCitation.__table__,
            ChatMessage.__table__,
            ChatThread.__table__,
            User.__table__,
        ],
    )


import asyncio


def test_orchestrate_chat_turn_success() -> None:
    async def _run():
        db = TestingSessionLocal()
        user = User(id=uuid.uuid4(), email="analyst@driftwood.com")
        db.add(user)
        thread = ChatThread(id=uuid.uuid4(), user_id=user.id, title="Apple Analysis")
        db.add(thread)
        db.commit()

        chunk_id = uuid.uuid4()
        passage_text = "iPhone revenue grew 6% year-over-year."
        retrieved_passage = RetrievedPassage(
            chunk_id=chunk_id,
            document_id=uuid.uuid4(),
            chunk_index=0,
            text=passage_text,
            page=10,
            section="Item 7",
            fusion_score=0.1,
            ticker="AAPL",
            company_name="Apple Inc.",
            form="10-K",
            filing_date=date(2024, 10, 31),
            fiscal_year=2024,
            accession_number="0000320193-24-000106",
        )

        mock_answer = GroundedAnswer(
            answer="Apple reported that iPhone revenue grew 6% year-over-year.",
            citations=[
                CitationItem(
                    chunk_id=chunk_id,
                    ticker="AAPL",
                    company="Apple Inc.",
                    form="10-K",
                    filing_date=date(2024, 10, 31),
                    year=2024,
                    page=10,
                    section="Item 7",
                    excerpt=passage_text,
                )
            ],
        )

        # Mock agent run so it populates deps.retrieved_passages and returns mock_answer
        async def mock_agent_run(prompt, deps=None, **kwargs):
            deps.retrieved_passages[chunk_id] = retrieved_passage
            result = MagicMock()
            result.output = mock_answer
            return result

        with patch("app.chat.orchestrator.doc_agent.run", new=mock_agent_run):
            messages = [AISDKMessage(role="user", content="How did iPhone revenue perform?")]
            chunks = []
            async for part in orchestrate_chat_turn(
                thread_id=thread.id,
                user_id=user.id,
                messages=messages,
                session_factory=TestingSessionLocal,
            ):
                chunks.append(part)

        stream_output = "".join(chunks)
        assert '0:"Apple' in stream_output
        assert '2:[{"type": "citations"' in stream_output
        assert 'd:{"finishReason": "stop"' in stream_output

        # Check database persistence
        persisted_messages = db.scalars(
            select(ChatMessage).where(ChatMessage.thread_id == thread.id)
        ).all()
        assert len(persisted_messages) == 1
        msg = persisted_messages[0]
        assert msg.role == "assistant"
        assert "iPhone revenue grew 6%" in msg.content

        # Check citation persistence
        persisted_citations = db.scalars(
            select(MessageCitation).where(MessageCitation.message_id == msg.id)
        ).all()
        assert len(persisted_citations) == 1
        cit = persisted_citations[0]
        assert cit.ticker == "AAPL"
        assert cit.chunk_id == chunk_id
        assert cit.page == 10
        assert cit.excerpt == passage_text
        db.close()

    asyncio.run(_run())


def test_orchestrate_chat_turn_validation_failure_fails_closed() -> None:
    async def _run():
        db = TestingSessionLocal()
        user = User(id=uuid.uuid4(), email="analyst@driftwood.com")
        db.add(user)
        thread = ChatThread(id=uuid.uuid4(), user_id=user.id, title="Test Thread")
        db.add(thread)
        db.commit()

        # Model hallucinated a citation for a chunk that was never retrieved
        unseen_chunk_id = uuid.uuid4()
        mock_answer = GroundedAnswer(
            answer="Fabricated financial fact.",
            citations=[
                CitationItem(
                    chunk_id=unseen_chunk_id,
                    ticker="AAPL",
                    company="Apple Inc.",
                    form="10-K",
                    filing_date=date(2024, 10, 31),
                    year=2024,
                    excerpt="Fabricated financial fact.",
                )
            ],
        )

        async def mock_agent_run(prompt, deps=None, **kwargs):
            # retrieved_passages left empty
            result = MagicMock()
            result.output = mock_answer
            return result

        with patch("app.chat.orchestrator.doc_agent.run", new=mock_agent_run):
            messages = [AISDKMessage(role="user", content="Test question")]
            chunks = []
            async for part in orchestrate_chat_turn(
                thread_id=thread.id,
                user_id=user.id,
                messages=messages,
                session_factory=TestingSessionLocal,
            ):
                chunks.append(part)

        stream_output = "".join(chunks)
        assert "Unable to verify response against the SEC filing corpus" in stream_output
        assert 'd:{"finishReason": "error"' in stream_output

        # Verify no ungrounded citations were persisted
        persisted_citations = db.scalars(select(MessageCitation)).all()
        assert len(persisted_citations) == 0

        # Verify assistant message has controlled error
        persisted_messages = db.scalars(select(ChatMessage)).all()
        assert len(persisted_messages) == 1
        assert "Unable to verify response" in persisted_messages[0].content
        db.close()

    asyncio.run(_run())

