from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.database.models.chat_message import ChatMessage
from app.database.models.chat_thread import ChatThread
from app.database.models.message_citation import MessageCitation


def list_user_threads(db: Session, user_id: uuid.UUID) -> Sequence[ChatThread]:
    """Return all chat threads belonging to a user, sorted by updated_at descending."""
    stmt = (
        select(ChatThread)
        .where(ChatThread.user_id == user_id)
        .order_by(desc(ChatThread.updated_at))
    )
    return db.scalars(stmt).all()


def get_thread(db: Session, thread_id: uuid.UUID) -> ChatThread | None:
    """Fetch a chat thread by ID."""
    stmt = select(ChatThread).where(ChatThread.id == thread_id)
    return db.scalars(stmt).first()


def create_thread(
    db: Session,
    user_id: uuid.UUID,
    title: str = "New Chat",
) -> ChatThread:
    """Create a new chat thread for a user."""
    thread = ChatThread(
        user_id=user_id,
        title=title,
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def update_thread_title(
    db: Session,
    thread: ChatThread,
    title: str,
) -> ChatThread:
    """Update a chat thread's title and updated_at timestamp."""
    thread.title = title
    thread.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(thread)
    return thread


def delete_thread(db: Session, thread: ChatThread) -> None:
    """Delete a chat thread and cascade to its messages."""
    db.delete(thread)
    db.commit()


def list_thread_messages(db: Session, thread_id: uuid.UUID) -> Sequence[ChatMessage]:
    """Return all messages for a thread, ordered chronologically."""
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return db.scalars(stmt).all()


def create_chat_message(
    db: Session,
    thread_id: uuid.UUID,
    role: str,
    content: str,
    parts: list[dict] | None = None,
) -> ChatMessage:
    """Persist a chat message turn and touch the parent thread's updated_at timestamp."""
    message = ChatMessage(
        thread_id=thread_id,
        role=role,
        content=content,
        parts=parts,
    )
    db.add(message)

    # Touch the thread's updated_at
    thread = get_thread(db, thread_id)
    if thread:
        thread.updated_at = func.now()

    db.commit()
    db.refresh(message)
    return message


def create_message_citations(
    db: Session,
    message_id: uuid.UUID,
    citations: Sequence[Any],
) -> list[MessageCitation]:
    """Persist normalized citations linked to a specific assistant chat message."""
    records: list[MessageCitation] = []
    for c in citations:
        chunk_id = getattr(c, "chunk_id", None) or (c.get("chunk_id") if isinstance(c, dict) else None)
        ticker = getattr(c, "ticker", None) or (c.get("ticker") if isinstance(c, dict) else "UNKNOWN")
        company = getattr(c, "company", None) or (c.get("company") if isinstance(c, dict) else "UNKNOWN")
        form = getattr(c, "form", None) or (c.get("form") if isinstance(c, dict) else "10-K")
        filing_date = getattr(c, "filing_date", None) or (c.get("filing_date") if isinstance(c, dict) else None)
        year = getattr(c, "year", None) or (c.get("year") if isinstance(c, dict) else None)
        accession_number = getattr(c, "accession_number", None) or (c.get("accession_number") if isinstance(c, dict) else None)
        page = getattr(c, "page", None) or (c.get("page") if isinstance(c, dict) else None)
        section = getattr(c, "section", None) or (c.get("section") if isinstance(c, dict) else None)
        source_url = getattr(c, "source_url", None) or (c.get("source_url") if isinstance(c, dict) else None)
        excerpt = getattr(c, "excerpt", None) or (c.get("excerpt") if isinstance(c, dict) else "")

        rec = MessageCitation(
            message_id=message_id,
            chunk_id=chunk_id,
            ticker=ticker,
            company=company,
            form=form,
            filing_date=filing_date,
            year=year,
            accession_number=accession_number,
            page=page,
            section=section,
            source_url=source_url,
            excerpt=excerpt,
        )
        records.append(rec)
        db.add(rec)

    if records:
        db.commit()
        for rec in records:
            db.refresh(rec)
    return records

