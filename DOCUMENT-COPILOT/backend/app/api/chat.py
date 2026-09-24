from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user_record
from app.chat.messages import (
    ChatMessageResponse,
    ChatStreamRequest,
    ChatThreadCreate,
    ChatThreadResponse,
    ChatThreadUpdate,
)
from app.chat.orchestrator import (
    orchestrate_chat_turn,
    validate_thread_access,
)
from app.chat.streaming import DATA_STREAM_HEADERS
from app.database import chats
from app.database.models.user import User
from app.database.session import get_db
from app.retrieval.queries import get_chunk_by_id, get_surrounding_chunks

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/threads", response_model=list[ChatThreadResponse])
async def list_threads(
    current_user: Annotated[User, Depends(get_current_user_record)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ChatThreadResponse]:
    """List all chat threads belonging to the authenticated user."""
    threads = chats.list_user_threads(db, current_user.id)
    return [ChatThreadResponse.model_validate(t) for t in threads]


@router.post(
    "/threads",
    response_model=ChatThreadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_thread(
    current_user: Annotated[User, Depends(get_current_user_record)],
    db: Annotated[Session, Depends(get_db)],
    payload: ChatThreadCreate | None = None,
    title: str | None = None,
) -> ChatThreadResponse:
    """Create a new chat thread for the authenticated user.
    
    Accepts title from JSON payload or optional query parameter, defaulting to 'New Chat'.
    """
    resolved_title = "New Chat"
    if payload and payload.title and payload.title.strip():
        resolved_title = payload.title.strip()
    elif title and title.strip():
        resolved_title = title.strip()

    thread = chats.create_thread(db, user_id=current_user.id, title=resolved_title)
    return ChatThreadResponse.model_validate(thread)



@router.get("/threads/{thread_id}", response_model=ChatThreadResponse)
async def get_thread_by_id(
    thread_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user_record)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatThreadResponse:
    """Retrieve details for a chat thread.

    Returns:
        404 if the thread does not exist.
        403 if the thread belongs to another user.
    """
    validate_thread_access(db, thread_id, current_user.id)
    thread = chats.get_thread(db, thread_id)
    return ChatThreadResponse.model_validate(thread)


@router.patch("/threads/{thread_id}", response_model=ChatThreadResponse)
async def update_thread(
    thread_id: uuid.UUID,
    payload: ChatThreadUpdate,
    current_user: Annotated[User, Depends(get_current_user_record)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatThreadResponse:
    """Update a chat thread's title."""
    validate_thread_access(db, thread_id, current_user.id)
    thread = chats.get_thread(db, thread_id)
    assert thread is not None
    updated = chats.update_thread_title(db, thread, payload.title)
    return ChatThreadResponse.model_validate(updated)


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user_record)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """Delete a chat thread and all its messages."""
    validate_thread_access(db, thread_id, current_user.id)
    thread = chats.get_thread(db, thread_id)
    assert thread is not None
    chats.delete_thread(db, thread)


@router.get("/threads/{thread_id}/messages", response_model=list[ChatMessageResponse])
async def list_thread_messages(
    thread_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user_record)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ChatMessageResponse]:
    """Retrieve the message history for a chat thread in chronological order.

    Returns:
        404 if the thread does not exist.
        403 if the thread belongs to another user.
    """
    validate_thread_access(db, thread_id, current_user.id)
    messages = chats.list_thread_messages(db, thread_id)
    return [ChatMessageResponse.model_validate(m) for m in messages]


@router.post("/stream")
async def stream_chat(
    payload: ChatStreamRequest,
    current_user: Annotated[User, Depends(get_current_user_record)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    """Stream an assistant response using the AI SDK Data Stream protocol.

    Persists the user query and the streamed assistant response to chat_messages.
    Returns:
        404 if the thread does not exist.
        403 if the thread belongs to another user.
    """
    thread = validate_thread_access(db, payload.thread_id, current_user.id)
    if not thread:
        thread = chats.get_thread(db, payload.thread_id)

    # Persist the latest incoming user message if present
    for message in reversed(payload.messages):
        if message.role == "user":
            chats.create_chat_message(
                db=db,
                thread_id=payload.thread_id,
                role="user",
                content=message.content,
                parts=message.parts,
            )
            if thread and getattr(thread, "title", None) in ("New Chat", "New chat", "") and message.content.strip():
                clean_title = message.content.strip()
                if len(clean_title) > 80:
                    clean_title = f"{clean_title[:77].strip()}…"
                chats.update_thread_title(db, thread, clean_title)
            break

    generator = orchestrate_chat_turn(
        thread_id=payload.thread_id,
        user_id=current_user.id,
        messages=payload.messages,
    )

    return StreamingResponse(
        generator,
        media_type="text/plain",
        headers=DATA_STREAM_HEADERS,
    )


class ChunkContextItem(BaseModel):
    id: uuid.UUID
    chunk_index: int
    page: int | None = None
    section: str | None = None
    content: str
    is_target: bool = False


class ChunkContextResponse(BaseModel):
    target_chunk_id: uuid.UUID
    ticker: str | None = None
    company: str | None = None
    form: str | None = None
    year: int | None = None
    chunks: list[ChunkContextItem]


@router.get("/chunks/{chunk_id}/context", response_model=ChunkContextResponse)
async def get_chunk_context_endpoint(
    chunk_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    window: int = 1,
) -> ChunkContextResponse:
    """Fetch the target chunk along with its surrounding neighboring chunks for context."""
    window = min(max(1, window), 2)
    target = get_chunk_by_id(db, chunk_id)
    if not target:
        raise HTTPException(status_code=404, detail="Chunk not found")

    surrounding = get_surrounding_chunks(db, chunk_id, window=window)
    items = []
    for c in surrounding:
        items.append(
            ChunkContextItem(
                id=c.id,
                chunk_index=c.chunk_index,
                page=c.page,
                section=c.section,
                content=c.content,
                is_target=(c.id == chunk_id),
            )
        )

    doc = target.document
    return ChunkContextResponse(
        target_chunk_id=chunk_id,
        ticker=doc.ticker if doc else None,
        company=doc.company if doc else None,
        form=doc.form if doc else None,
        year=doc.year if doc else None,
        chunks=items,
    )
