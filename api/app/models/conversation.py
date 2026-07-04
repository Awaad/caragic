from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    visitor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visitors.id", ondelete="CASCADE"),
        nullable=False,
    )
    submission_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("submissions.id", ondelete="SET NULL"),
        nullable=True,
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="instant")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    unread_by_owner: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    owner_receipts_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    unread_by_visitor: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    __table_args__ = (
        CheckConstraint("kind IN ('instant', 'ai')", name="conversations_kind_check"),
        CheckConstraint(
            "status IN ('open', 'closed', 'archived')",
            name="conversations_status_check",
        ),
    )