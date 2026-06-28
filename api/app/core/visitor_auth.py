from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..models import Visitor, VisitorSessionToken

VISITOR_COOKIE_NAME = "visitor_session"


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _generate_raw_token() -> str:
    # 32 bytes = 256 bits of entropy. token_urlsafe returns ~43 chars.
    return secrets.token_urlsafe(32)


async def issue_session_for_visitor(
    db: AsyncSession, visitor: Visitor
) -> tuple[str, VisitorSessionToken]:
    """Create a fresh session token for an existing visitor. Returns (raw_token, row)."""
    settings = get_settings()
    raw = _generate_raw_token()
    now = datetime.now(timezone.utc)
    row = VisitorSessionToken(
        visitor_id=visitor.id,
        token_hash=_hash_token(raw),
        issued_at=now,
        expires_at=now + timedelta(days=settings.visitor_session_ttl_days),
    )
    db.add(row)
    await db.flush()
    return raw, row


async def create_visitor_with_session(db: AsyncSession) -> tuple[str, VisitorSessionToken, Visitor]:
    """Create a brand-new visitor and issue their first session token."""
    visitor = Visitor()
    db.add(visitor)
    await db.flush()
    raw, row = await issue_session_for_visitor(db, visitor)
    return raw, row, visitor


async def _rotate_if_needed(
    db: AsyncSession, row: VisitorSessionToken
) -> tuple[str | None, VisitorSessionToken]:
    """If `row` is past its rotate-after threshold, mark it superseded and
    issue a new token for the same visitor. Returns (new_raw_token_or_None, active_row).

    new_raw_token is None if no rotation happened.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    rotate_threshold = row.issued_at + timedelta(days=settings.visitor_session_rotate_after_days)
    if now < rotate_threshold or row.superseded_at is not None:
        return None, row

    # Rotate: supersede the old row, issue a new one
    row.superseded_at = now
    row.superseded_grace_until = now + timedelta(hours=settings.visitor_session_grace_hours)
    new_raw = _generate_raw_token()
    new_row = VisitorSessionToken(
        visitor_id=row.visitor_id,
        token_hash=_hash_token(new_raw),
        issued_at=now,
        expires_at=now + timedelta(days=settings.visitor_session_ttl_days),
    )
    db.add(new_row)
    await db.flush()
    return new_raw, new_row


async def resolve_session(
    db: AsyncSession, raw_token: str
) -> tuple[Visitor, VisitorSessionToken, str | None]:
    """Look up the session by hashed token. Returns (visitor, active_row, new_raw_if_rotated).

    Raises 401 on missing/expired/revoked/superseded-past-grace/visitor-revoked.
    """
    now = datetime.now(timezone.utc)
    token_hash = _hash_token(raw_token)

    stmt = (
        select(VisitorSessionToken)
        .where(VisitorSessionToken.token_hash == token_hash)
        .where(VisitorSessionToken.revoked.is_(False))
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid session")

    if row.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="session expired")

    # If this row was superseded, accept it only inside the grace window
    if row.superseded_at is not None:
        if row.superseded_grace_until is None or row.superseded_grace_until <= now:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="session superseded")

    visitor_stmt = select(Visitor).where(Visitor.id == row.visitor_id)
    visitor = (await db.execute(visitor_stmt)).scalar_one_or_none()
    if visitor is None or visitor.revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="visitor revoked")

    # Touch last_seen_at
    visitor.last_seen_at = now

    # Only rotate the current (non-superseded) row. A request arriving on the
    # old token during grace doesn't trigger another rotation.
    new_raw: str | None = None
    active_row = row
    if row.superseded_at is None:
        new_raw, active_row = await _rotate_if_needed(db, row)

    return visitor, active_row, new_raw


async def get_current_visitor(
    visitor_session: str | None = Cookie(default=None),
    db: AsyncSession = ...,
):
    """FastAPI dependency. Imported and bound in deps.py to inject the db session correctly."""
    raise NotImplementedError("Use the wired version in app/api/deps.py")