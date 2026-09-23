from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.database.models.chat_message import ChatMessage
    from app.database.models.document_chunk import DocumentChunk


class MessageCitation(Base):
    """Normalized citation linking an assistant message to a retrieved chunk or filing."""

    __tablename__ = "message_citations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ticker: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    company: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    form: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    filing_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    year: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    accession_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    page: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    section: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    source_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    excerpt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    message: Mapped[ChatMessage] = relationship(
        "ChatMessage",
        back_populates="citations",
    )
    chunk: Mapped[DocumentChunk | None] = relationship(
        "DocumentChunk",
        back_populates="citations",
    )
