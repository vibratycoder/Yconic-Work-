"""Conversation data models."""
from __future__ import annotations
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class Message(BaseModel):
    """Single chat message in a conversation."""
    role: str
    content: str


class Conversation(BaseModel):
    """
    A complete conversation session with citations and health domain.

    Attributes:
        id: Unique conversation ID
        user_id: Supabase auth user ID
        messages: Ordered list of messages
        health_domain: Classified domain for this conversation
        citations: PubMed citations used in responses
        created_at: Conversation start time
    """
    id: str | None = None
    user_id: str
    messages: list[Message] = Field(default_factory=list)
    health_domain: str | None = None
    citations: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
