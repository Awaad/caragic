from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ConversationSummary(BaseModel):
    id: uuid.UUID
    kind: Literal["instant", "ai"]
    status: Literal["open", "closed", "archived"]
    created_at: datetime
    last_message_at: datetime | None
    unread_by_owner: bool


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender: Literal["visitor", "owner", "ai", "system"]
    content_type: Literal["text", "image", "file", "system"]
    content: str
    content_metadata: dict = Field(default_factory=dict)
    created_at: datetime


class MessageListResponse(BaseModel):
    messages: list[MessageOut]  # newest first; caller appends older on top
    next_cursor: uuid.UUID | None


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class SendMessageResponse(BaseModel):
    message: MessageOut


class GetOrCreateConversationResponse(BaseModel):
    conversation: ConversationSummary