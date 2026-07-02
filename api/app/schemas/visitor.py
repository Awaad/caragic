from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class VisitorSessionResponse(BaseModel):
    visitor_id: UUID
    issued_at: datetime
    expires_at: datetime
    rotated: bool = False
    
class AnswerIn(BaseModel):
    round_id: str = Field(min_length=1, max_length=64)
    option_id: str = Field(min_length=1, max_length=64)


class SubmissionRequest(BaseModel):
    """Discriminated on `outcome`. Pydantic doesn't enforce the cross-field
    rule (submitted ⇒ name+phone present); the service layer does.

    Frontend sends name + phone as raw user-entered strings; server
    normalizes phone to E.164 before encryption."""

    outcome: Literal["submitted", "declined"]
    name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    answers: list[AnswerIn] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("phone")
    @classmethod
    def _strip_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class SubmissionResponse(BaseModel):
    id: UUID
    outcome: Literal["submitted", "declined"]
    attempt_number: int
    created_at: datetime


class EraseRequestResponse(BaseModel):
    """What the visitor sees after requesting erasure — no submission id,
    no status details. Just confirmation."""
    accepted: bool
    message: str