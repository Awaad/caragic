from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Setting, Token, Visitor, VisitorSessionToken
from .visitor_auth import VISITOR_COOKIE_NAME


VALID_MODES = {"dating", "mix", "friendship", "professional"}


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _generate_raw() -> str:
    # 32 bytes = 256 bits. token_urlsafe gives ~43 url-safe chars.
    return secrets.token_urlsafe(32)


async def get_active_mode(db: AsyncSession) -> str:
    """Read the active mode from settings. Falls back to 'friendship' if unset
    (shouldn't happen — migration 003 seeds it — but defensive)."""
    row = (await db.execute(select(Setting).where(Setting.key == "active_mode"))).scalar_one_or_none()
    if row is None or row.value not in VALID_MODES:
        return "friendship"
    return row.value


async def set_active_mode(db: AsyncSession, mode: str) -> str:
    if mode not in VALID_MODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid mode: {mode}",
        )
    row = (await db.execute(select(Setting).where(Setting.key == "active_mode"))).scalar_one_or_none()
    if row is None:
        row = Setting(key="active_mode", value=mode)
        db.add(row)
    else:
        row.value = mode
    await db.flush()
    return mode


async def mint_token(
    db: AsyncSession,
    *,
    kind: str,
    mode: str,
    label: str | None = None,
) -> tuple[str, Token]:
    """Create a fresh token row. Returns (raw_token, row).
    raw_token is the only time the unhashed value exists in memory."""
    if kind not in {"card", "link"}:
        raise ValueError(f"invalid token kind: {kind}")
    if mode not in VALID_MODES:
        raise ValueError(f"invalid mode: {mode}")

    raw = _generate_raw()
    row = Token(
        token_hash=_hash(raw),
        kind=kind,
        mode=mode,
        label=label,
    )
    db.add(row)
    await db.flush()
    return raw, row


async def resolve_link_token(db: AsyncSession, raw: str) -> Token:
    """Resolve a kind='link' token from its raw value. Raises 404 if not found,
    410 if revoked/inactive."""
    row = (
        await db.execute(
            select(Token).where(Token.token_hash == _hash(raw)).where(Token.kind == "link")
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="token not found")
    if row.revoked or not row.active:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="token no longer valid")
    return row


async def mint_session_for_token(
    db: AsyncSession,
    *,
    token: Token,
) -> tuple[str, Visitor, VisitorSessionToken]:
    """Create a new visitor + session bound to the given token. Returns
    (raw_session_token, visitor, session_row)."""
    settings = get_settings()
    now = datetime.now(timezone.utc)

    visitor = Visitor()
    db.add(visitor)
    await db.flush()  # populate visitor.id

    raw = _generate_raw()
    session_row = VisitorSessionToken(
        visitor_id=visitor.id,
        token_id=token.id,
        token_hash=_hash(raw),
        issued_at=now,
        expires_at=now + timedelta(days=settings.visitor_session_ttl_days),
    )
    db.add(session_row)

    # Mark the token used
    token.tap_count = (token.tap_count or 0) + 1
    token.last_used_at = now

    await db.flush()
    return raw, visitor, session_row


async def revoke_existing_session_cookie(db: AsyncSession, raw_cookie: str | None) -> None:
    """If the incoming request carries an old visitor_session cookie, mark
    that session revoked. Called when a fresh tap/link mints a new session
    on top of an existing one — prevents the old session from continuing
    to work alongside the new."""
    if raw_cookie is None:
        return
    old = (
        await db.execute(
            select(VisitorSessionToken).where(
                VisitorSessionToken.token_hash == _hash(raw_cookie)
            )
        )
    ).scalar_one_or_none()
    if old is not None and not old.revoked:
        old.revoked = True


def set_visitor_session_cookie(response: Response, raw_token: str) -> None:
    """Shared cookie writer. Same shape as the original visitor_session cookie."""
    settings = get_settings()
    response.set_cookie(
        key=VISITOR_COOKIE_NAME,
        value=raw_token,
        max_age=settings.visitor_session_ttl_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )