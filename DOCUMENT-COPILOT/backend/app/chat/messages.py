from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ChatThreadCreate(BaseModel):
    """Payload to create a new chat thread."""

    model_config = ConfigDict(extra="ignore")

    title: str | None = Field(default="New Chat")


class ChatThreadUpdate(BaseModel):
    """Payload to update an existing chat thread."""

    title: str


class ChatThreadResponse(BaseModel):
    """Response schema representing a chat thread."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ChatMessageResponse(BaseModel):
    """Response schema representing a chat message."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    thread_id: uuid.UUID
    role: str
    content: str
    parts: list[dict[str, Any]] | None = None
    created_at: datetime


class AISDKMessage(BaseModel):
    """Wire model representing an AI SDK UI message."""

    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    role: str
    content: str = ""
    parts: list[dict[str, Any]] | None = None


class ChatStreamRequest(BaseModel):
    """Request payload for POST /chat/stream."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    thread_id: uuid.UUID = Field(..., alias="threadId")
    messages: list[AISDKMessage] = Field(default_factory=list)


def extract_user_query(messages: list[AISDKMessage]) -> str:
    """Extract the most recent user text query from an AI SDK messages list."""
    for message in reversed(messages):
        if message.role == "user":
            if message.content:
                return message.content
            if message.parts:
                for part in message.parts:
                    if part.get("type") == "text" and part.get("text"):
                        return part["text"]
    return ""
