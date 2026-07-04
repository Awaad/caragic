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
    read_by_recipient_at: datetime | None = None


class MessageListResponse(BaseModel):
    messages: list[MessageOut]  # newest first; caller appends older on top
    next_cursor: uuid.UUID | None


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class SendMessageResponse(BaseModel):
    message: MessageOut


class GetOrCreateConversationResponse(BaseModel):
    conversation: ConversationSummary
    
    
class OwnerStatusOut(BaseModel):
    status: Literal["available", "away", "busy", "offline"]
    updated_at: datetime | None = None


class OwnerStatusIn(BaseModel):
    status: Literal["available", "away", "busy", "offline"]


class AdminConversationSummary(BaseModel):
    id: uuid.UUID
    visitor_id: uuid.UUID
    kind: Literal["instant", "ai"]
    status: Literal["open", "closed", "archived"]
    created_at: datetime
    last_message_at: datetime | None
    unread_by_owner: bool
    owner_receipts_enabled: bool
    # preview: last message content decrypted, truncated
    last_message_preview: str | None = None
    last_message_sender: str | None = None


class AdminConversationListResponse(BaseModel):
    conversations: list[AdminConversationSummary]


class ReadReceiptRequest(BaseModel):
    message_ids: list[uuid.UUID]


class ToggleReceiptsRequest(BaseModel):
    enabled: bool