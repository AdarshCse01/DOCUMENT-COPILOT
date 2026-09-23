import uuid
from collections.abc import Generator
from typing import Annotated
from unittest.mock import patch

import pytest
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.dependencies import AuthenticatedUser, get_current_user
from app.database.base import Base
from app.database.models.chat_message import ChatMessage
from app.database.models.chat_thread import ChatThread
from app.database.models.message_citation import MessageCitation
from app.database.models.user import User
from app.database.session import get_db
from app.main import app


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

bearer_scheme = HTTPBearer(auto_error=False)

USER_A_ID = uuid.uuid4()
USER_B_ID = uuid.uuid4()
USER_A_EMAIL = "analyst_a@driftwood.com"
USER_B_EMAIL = "analyst_b@driftwood.com"

AUTH_HEADERS_A = {"Authorization": "Bearer token_a"}
AUTH_HEADERS_B = {"Authorization": "Bearer token_b"}


@pytest.fixture(autouse=True)
def setup_test_db():
    """Create fresh database tables before each test and drop after."""
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


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a scoped test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def configure_app():
    """Override FastAPI dependencies with in-memory DB and token-based test users."""
    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_get_current_user(
        credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    ) -> AuthenticatedUser:
        if not credentials or not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
            )
        token = credentials.credentials.strip()
        if token == "token_a":
            return AuthenticatedUser(
                id=USER_A_ID,
                email=USER_A_EMAIL,
                access_token="token_a",
            )
        if token == "token_b":
            return AuthenticatedUser(
                id=USER_B_ID,
                email=USER_B_EMAIL,
                access_token="token_b",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with patch("app.chat.orchestrator.SessionLocal", TestingSessionLocal):
        yield

    app.dependency_overrides.clear()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


# ===========================================================================
# 1. Chat Thread CRUD Tests
# ===========================================================================


def test_list_threads_initially_empty(client: TestClient):
    response = client.get("/chat/threads", headers=AUTH_HEADERS_A)
    assert response.status_code == 200
    assert response.json() == []


def test_create_thread(client: TestClient):
    # 1. Regular payload with explicit title
    response = client.post(
        "/chat/threads",
        json={"title": "Apple Q4 Filing"},
        headers=AUTH_HEADERS_A,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Apple Q4 Filing"
    assert data["user_id"] == str(USER_A_ID)
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data

    # 2. Resilient to empty json payload
    res_empty_json = client.post("/chat/threads", json={}, headers=AUTH_HEADERS_A)
    assert res_empty_json.status_code == 201
    assert res_empty_json.json()["title"] == "New Chat"

    # 3. Resilient to null title in payload
    res_null_title = client.post("/chat/threads", json={"title": None}, headers=AUTH_HEADERS_A)
    assert res_null_title.status_code == 201
    assert res_null_title.json()["title"] == "New Chat"

    # 4. Resilient to missing request body completely
    res_no_body = client.post("/chat/threads", headers=AUTH_HEADERS_A)
    assert res_no_body.status_code == 201
    assert res_no_body.json()["title"] == "New Chat"

    # 5. Query parameter title support
    res_query = client.post("/chat/threads?title=From+Query", headers=AUTH_HEADERS_A)
    assert res_query.status_code == 201
    assert res_query.json()["title"] == "From Query"



def test_list_threads_filters_by_user(client: TestClient):
    # User A creates 2 threads
    client.post("/chat/threads", json={"title": "Thread A1"}, headers=AUTH_HEADERS_A)
    client.post("/chat/threads", json={"title": "Thread A2"}, headers=AUTH_HEADERS_A)

    # User B creates 1 thread
    client.post("/chat/threads", json={"title": "Thread B1"}, headers=AUTH_HEADERS_B)

    # Check User A's list
    res_a = client.get("/chat/threads", headers=AUTH_HEADERS_A)
    assert res_a.status_code == 200
    titles_a = [t["title"] for t in res_a.json()]
    assert len(titles_a) == 2
    assert "Thread A1" in titles_a
    assert "Thread A2" in titles_a
    assert "Thread B1" not in titles_a

    # Check User B's list
    res_b = client.get("/chat/threads", headers=AUTH_HEADERS_B)
    assert res_b.status_code == 200
    titles_b = [t["title"] for t in res_b.json()]
    assert len(titles_b) == 1
    assert "Thread B1" in titles_b


def test_get_thread_by_id(client: TestClient):
    create_res = client.post(
        "/chat/threads",
        json={"title": "Tesla 10-K"},
        headers=AUTH_HEADERS_A,
    )
    thread_id = create_res.json()["id"]

    res = client.get(f"/chat/threads/{thread_id}", headers=AUTH_HEADERS_A)
    assert res.status_code == 200
    assert res.json()["id"] == thread_id
    assert res.json()["title"] == "Tesla 10-K"


def test_update_thread_title(client: TestClient):
    create_res = client.post(
        "/chat/threads",
        json={"title": "Old Title"},
        headers=AUTH_HEADERS_A,
    )
    thread_id = create_res.json()["id"]

    res = client.patch(
        f"/chat/threads/{thread_id}",
        json={"title": "Renamed Title"},
        headers=AUTH_HEADERS_A,
    )
    assert res.status_code == 200
    assert res.json()["title"] == "Renamed Title"


def test_delete_thread(client: TestClient):
    create_res = client.post(
        "/chat/threads",
        json={"title": "To Delete"},
        headers=AUTH_HEADERS_A,
    )
    thread_id = create_res.json()["id"]

    del_res = client.delete(f"/chat/threads/{thread_id}", headers=AUTH_HEADERS_A)
    assert del_res.status_code == 204

    # Subsequent GET returns 404
    get_res = client.get(f"/chat/threads/{thread_id}", headers=AUTH_HEADERS_A)
    assert get_res.status_code == 404


def test_list_thread_messages_empty(client: TestClient):
    create_res = client.post(
        "/chat/threads",
        json={"title": "Chat"},
        headers=AUTH_HEADERS_A,
    )
    thread_id = create_res.json()["id"]

    res = client.get(f"/chat/threads/{thread_id}/messages", headers=AUTH_HEADERS_A)
    assert res.status_code == 200
    assert res.json() == []


# ===========================================================================
# 2. Authorization Invariants: 403 Forbidden vs 404 Not Found
# ===========================================================================


def test_get_thread_not_found_404(client: TestClient):
    random_id = uuid.uuid4()
    res = client.get(f"/chat/threads/{random_id}", headers=AUTH_HEADERS_A)
    assert res.status_code == 404
    assert f"Thread {random_id} not found" in res.json()["detail"]


def test_get_thread_forbidden_403(client: TestClient):
    create_res = client.post(
        "/chat/threads",
        json={"title": "User A Private Thread"},
        headers=AUTH_HEADERS_A,
    )
    thread_a_id = create_res.json()["id"]

    # User B attempts to access User A's thread
    res = client.get(f"/chat/threads/{thread_a_id}", headers=AUTH_HEADERS_B)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_update_thread_forbidden_403(client: TestClient):
    create_res = client.post(
        "/chat/threads",
        json={"title": "User A Thread"},
        headers=AUTH_HEADERS_A,
    )
    thread_a_id = create_res.json()["id"]

    res = client.patch(
        f"/chat/threads/{thread_a_id}",
        json={"title": "Hacked Title"},
        headers=AUTH_HEADERS_B,
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_delete_thread_forbidden_403(client: TestClient):
    create_res = client.post(
        "/chat/threads",
        json={"title": "User A Thread"},
        headers=AUTH_HEADERS_A,
    )
    thread_a_id = create_res.json()["id"]

    res = client.delete(f"/chat/threads/{thread_a_id}", headers=AUTH_HEADERS_B)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_get_messages_forbidden_403(client: TestClient):
    create_res = client.post(
        "/chat/threads",
        json={"title": "User A Thread"},
        headers=AUTH_HEADERS_A,
    )
    thread_a_id = create_res.json()["id"]

    res = client.get(f"/chat/threads/{thread_a_id}/messages", headers=AUTH_HEADERS_B)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_chat_stream_forbidden_403(client: TestClient):
    create_res = client.post(
        "/chat/threads",
        json={"title": "User A Thread"},
        headers=AUTH_HEADERS_A,
    )
    thread_a_id = create_res.json()["id"]

    res = client.post(
        "/chat/stream",
        json={
            "threadId": thread_a_id,
            "messages": [{"role": "user", "content": "What is in this thread?"}],
        },
        headers=AUTH_HEADERS_B,
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_chat_stream_not_found_404(client: TestClient):
    random_id = str(uuid.uuid4())
    res = client.post(
        "/chat/stream",
        json={
            "threadId": random_id,
            "messages": [{"role": "user", "content": "Hello"}],
        },
        headers=AUTH_HEADERS_A,
    )
    assert res.status_code == 404


# ===========================================================================
# 3. Streaming and Message Persistence Tests
# ===========================================================================


def test_chat_stream_protocol_and_persistence(client: TestClient):
    from datetime import date
    from unittest.mock import MagicMock

    from app.assistant.agent import CitationItem, GroundedAnswer
    from app.retrieval.types import RetrievedPassage

    # 1. Create thread
    create_res = client.post(
        "/chat/threads",
        json={"title": "Apple FY24 Analysis"},
        headers=AUTH_HEADERS_A,
    )
    thread_id = create_res.json()["id"]

    chunk_id = uuid.uuid4()
    passage_text = "Apple total net sales were $391,035 million in 2024."
    retrieved_passage = RetrievedPassage(
        chunk_id=chunk_id,
        document_id=uuid.uuid4(),
        chunk_index=0,
        text=passage_text,
        page=12,
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
        answer="Apple reported total net sales of $391,035 million in 2024.",
        citations=[
            CitationItem(
                chunk_id=chunk_id,
                ticker="AAPL",
                company="Apple Inc.",
                form="10-K",
                filing_date=date(2024, 10, 31),
                year=2024,
                page=12,
                section="Item 7",
                excerpt=passage_text,
            )
        ],
    )

    async def mock_agent_run(prompt, deps=None, **kwargs):
        deps.retrieved_passages[chunk_id] = retrieved_passage
        res = MagicMock()
        res.output = mock_answer
        return res

    # 2. Call POST /chat/stream with mock
    question = "What was Apple's total net sales in 2024?"
    with patch("app.chat.orchestrator.doc_agent.run", new=mock_agent_run):
        stream_res = client.post(
            "/chat/stream",
            json={
                "threadId": thread_id,
                "messages": [
                    {
                        "id": "user-msg-1",
                        "role": "user",
                        "content": question,
                    }
                ],
            },
            headers=AUTH_HEADERS_A,
        )
    assert stream_res.status_code == 200
    assert stream_res.headers["X-Vercel-AI-Data-Stream"] == "v1"
    assert "text/plain" in stream_res.headers["Content-Type"]

    # Read stream output
    stream_content = stream_res.text
    # Verify AI SDK Data Stream protocol format lines
    assert '0:"Apple' in stream_content
    assert '2:[{"type": "citations"' in stream_content
    assert 'd:{"finishReason": "stop"' in stream_content

    # 3. Verify messages are persisted in DB
    history_res = client.get(f"/chat/threads/{thread_id}/messages", headers=AUTH_HEADERS_A)
    assert history_res.status_code == 200
    messages = history_res.json()
    assert len(messages) == 2

    # User message
    user_msg = messages[0]
    assert user_msg["role"] == "user"
    assert user_msg["content"] == question

    # Assistant message
    assistant_msg = messages[1]
    assert assistant_msg["role"] == "assistant"
    assert "Apple reported total net sales" in assistant_msg["content"]

