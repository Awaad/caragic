"""Notifications configuration schema.

Stored as JSONB in settings under key 'notifications_config'.
Password field asymmetry:
  - GET returns smtp_password_set: bool, not the password itself
  - PUT: empty smtp_password means "keep the existing one"
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class NotificationsConfig(BaseModel):
    """Internal shape, serialized to JSONB in the DB. Not returned directly
    to the admin UI — that goes through NotificationsConfigOut."""

    enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""  # stored plaintext; 
    smtp_use_tls: bool = True
    notification_from: str = ""
    notification_to: list[str] = Field(default_factory=list)
    last_sent_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error_message: str | None = None


class NotificationsConfigOut(BaseModel):
    """What the admin UI sees on GET. Password is redacted."""

    enabled: bool
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password_set: bool
    smtp_use_tls: bool
    notification_from: str
    notification_to: list[str]
    last_sent_at: datetime | None
    last_error_at: datetime | None
    last_error_message: str | None


class NotificationsConfigIn(BaseModel):
    """What the admin UI sends on PUT. Empty smtp_password = keep existing."""

    enabled: bool
    smtp_host: str
    smtp_port: int = Field(ge=1, le=65535)
    smtp_username: str
    smtp_password: str = ""  # empty = don't change
    smtp_use_tls: bool
    notification_from: str
    notification_to: list[str]

    @field_validator("notification_to")
    @classmethod
    def _validate_recipients(cls, v: list[str]) -> list[str]:
        cleaned = [addr.strip() for addr in v if addr.strip()]
        for addr in cleaned:
            # Cheap validation, full RFC parsing is overkill, catches typos
            if "@" not in addr or " " in addr:
                raise ValueError(f"invalid email: {addr!r}")
        return cleaned


class TestNotificationRequest(BaseModel):
    """Send-test uses whatever the admin has in the form right now,
    not what's persisted. Lets them validate creds before saving."""

    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str  # required for test no keep-existing logic
    smtp_use_tls: bool
    notification_from: str
    notification_to: list[str]


class TestNotificationResponse(BaseModel):
    success: bool
    message: str