from datetime import datetime
from typing import Any, Literal
from uuid import UUID
import uuid
from pydantic import BaseModel, Field




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
    next_cursor: uuid.UUID | None = None
    
SubmissionStatus = Literal[
    "pending", "read", "archived", "erase_requested", "erased"
]  

class AdminSubmissionSummary(BaseModel):
    """Inbox list row — no decrypted PII. Shows attempt history and outcome
    at a glance; full detail requires a separate fetch."""
    id: UUID
    mode: str
    outcome: Literal["submitted", "declined"]
    status: SubmissionStatus
    attempt_number: int
    has_identity: bool  # True iff name_encrypted is not null (i.e. outcome='submitted')
    answer_count: int
    created_at: datetime
    
class AdminSubmissionAnswer(BaseModel):
    """Answer as stored on the submission row. All fields are historical
    snapshots — safe to render even if mode content has since changed."""
    round_id: str
    option_id: str
    question: str | None = None       # None only for pre-snapshot legacy rows
    option_label: str | None = None
    reveal_text: str | None = None


class AdminSubmissionDetail(BaseModel):
    """Decrypted detail view. Hitting this endpoint is the act that reveals
    the visitor's identity — log accordingly if/when audit logging lands."""
    id: UUID
    mode: str
    outcome: Literal["submitted", "declined"]
    status: SubmissionStatus
    attempt_number: int
    name: str | None
    phone: str | None  # E.164
    phone_hash: str | None
    answers: list[AdminSubmissionAnswer] 
    visitor_id: UUID
    session_id: UUID
    token_id: UUID
    created_at: datetime


class AdminSubmissionListResponse(BaseModel):
    submissions: list[AdminSubmissionSummary]
    # Cursor for pagination; None when there are no more pages.
    next_cursor: UUID | None = None




class SubmissionStatusRequest(BaseModel):
    status: SubmissionStatus
    
    
    
class WhoAmIResponse(BaseModel):
    username: str
    

class EraseSubmissionResponse(BaseModel):
    """Admin finalize response. Returns the updated summary + a note that
    identity is now gone (helpful confirmation in the UI)."""
    id: uuid.UUID
    status: SubmissionStatus
    finalized_at: datetime
    finalized_by: str
    
    
class AdminSubmissionStatsResponse(BaseModel):
    pending: int
    read: int
    archived: int
    erase_requested: int
    erased: int