from __future__ import annotations

import uuid
from datetime import datetime

import uuid_utils

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, LargeBinary, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


def _new_message_id() -> uuid.UUID:
    """UUID v7 — time-ordered, sortable by id. First 48 bits are unix-ms
    timestamp; makes `ORDER BY id DESC` chronological, so pagination is
    a simple keyset on id alone."""
    return uuid.UUID(str(uuid_utils.uuid7()))


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=_new_message_id,
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender: Mapped[str] = mapped_column(String(16), nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="text"
    )
    content_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_metadata: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    
    read_by_recipient_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "sender IN ('visitor', 'owner', 'ai', 'system')",
            name="messages_sender_check",
        ),
        CheckConstraint(
            "content_type IN ('text', 'image', 'file', 'system')",
            name="messages_content_type_check",
        ),
    )