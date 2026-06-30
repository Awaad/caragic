"""Submission model every flow completion (submitted or declined) lands here.

Token-bound, session-bound, visitor-bound. name + phone are stored as
AES-GCM ciphertext bytes (NULL on declines). phone_hash is the deterministic
HMAC fingerprint of the canonical E.164 (NULL on declines).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class Submission(Base):
    __tablename__ = "submissions"

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
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visitor_session_tokens.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tokens.id", ondelete="RESTRICT"),
        nullable=False,
    )
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    attempt_number: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="1"
    )
    name_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    phone_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    phone_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    answers: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __table_args__ = (
        CheckConstraint(
            "outcome IN ('submitted', 'declined')",
            name="submissions_outcome_check",
        ),
        CheckConstraint(
            "status IN ('pending', 'read', 'archived')",
            name="submissions_status_check",
        ),
        CheckConstraint(
            "(outcome = 'submitted' AND name_encrypted IS NOT NULL "
            " AND phone_encrypted IS NOT NULL AND phone_hash IS NOT NULL) "
            "OR (outcome = 'declined' AND name_encrypted IS NULL "
            " AND phone_encrypted IS NULL AND phone_hash IS NULL)",
            name="submissions_outcome_payload_check",
        ),
        CheckConstraint(
            "attempt_number >= 1",
            name="submissions_attempt_number_check",
        ),
    )