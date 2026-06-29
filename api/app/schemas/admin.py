from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# Existing schemas (login, me, etc.) stay as they are.
# Adding below:


class CreateTokenRequest(BaseModel):
    mode: str = Field(min_length=1, max_length=32)  # was pattern="^(dating|...)$"
    label: str | None = Field(default=None, max_length=255)


class CreateTokenResponse(BaseModel):
    id: str           # token row id (UUID as string)
    token: str        # the raw token — only returned once, here, never again
    url: str          # full shareable URL
    mode: str
    label: str | None
    kind: str         # always 'link' from this endpoint


class SetActiveModeRequest(BaseModel):
    mode: str = Field(min_length=1, max_length=32)


class ActiveModeResponse(BaseModel):
    mode: str
    


ModeStatus = Literal["active", "inactive", "archived"]


class ChoiceOptionIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=255)
    revealText: str = Field(min_length=1, max_length=2048)


class ChoiceRoundDataIn(BaseModel):
    question: str = Field(min_length=1, max_length=1024)
    options: list[ChoiceOptionIn] = Field(min_length=2, max_length=4)


class CaptureRoundDataIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=1024)
    acceptLabel: str = Field(min_length=1, max_length=64)
    declineLabel: str = Field(min_length=1, max_length=64)
    declineMessage: str = Field(min_length=1, max_length=512)


class RoundIn(BaseModel):
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    round_type: Literal["choice", "capture"]
    data: dict[str, Any]  # validated by mode of round_type at the service layer


class RevealIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    tagline: str = Field(default="", max_length=1024)
    links: list[Any] = Field(default_factory=list)


class CreateModeRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32, pattern=r"^[a-z0-9_-]+$")
    rounds: list[RoundIn] = Field(min_length=1)
    reveal: RevealIn


class ModeStatusRequest(BaseModel):
    status: ModeStatus


class ModeSummary(BaseModel):
    id: str
    name: str
    status: ModeStatus
    round_count: int
    created_at: datetime
    updated_at: datetime


class ModeListResponse(BaseModel):
    modes: list[ModeSummary]


# tokens lifecycle

TokenStatus = Literal["active", "inactive", "revoked"]


class TokenStatusRequest(BaseModel):
    status: TokenStatus
    reason: str | None = Field(default=None, max_length=255)  # used when status='revoked'


class TokenSummary(BaseModel):
    id: str
    kind: Literal["card", "link"]
    mode: str
    label: str | None
    status: TokenStatus
    tap_count: int
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None
    revoked_reason: str | None


class TokenListResponse(BaseModel):
    tokens: list[TokenSummary]