from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Mode, Setting, Token, Visitor, VisitorSessionToken
from .visitor_auth import VISITOR_COOKIE_NAME


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _generate_raw() -> str:
    return secrets.token_urlsafe(32)


async def _mode_must_be_active(db: AsyncSession, mode_name: str) -> Mode:
    """Resolve a mode name to a Mode row, refusing anything not 'active'.
    Used by token minting and active-mode setting — both should only see
    fully usable modes."""
    row = (await db.execute(select(Mode).where(Mode.name == mode_name))).scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"mode not found: {mode_name}",
        )
    if row.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"mode {mode_name!r} is {row.status}, not active",
        )
    return row


async def get_active_mode(db: AsyncSession) -> str:
    """Read the active mode from settings.

    Defensive fallback: if the configured mode no longer exists or isn't
    active (e.g. owner deactivated it without updating the setting),
    pick any active mode deterministically. Never returns a non-active mode."""
    setting = (
        await db.execute(select(Setting).where(Setting.key == "active_mode"))
    ).scalar_one_or_none()
    configured = setting.value if setting is not None else None

    if isinstance(configured, str):
        row = (
            await db.execute(select(Mode).where(Mode.name == configured))
        ).scalar_one_or_none()
        if row is not None and row.status == "active":
            return configured

    # Fallback: any active mode, alphabetical for determinism.
    fallback = (
        await db.execute(
            select(Mode).where(Mode.status == "active").order_by(Mode.name).limit(1)
        )
    ).scalar_one_or_none()
    if fallback is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="no active modes configured",
        )
    return fallback.name


async def set_active_mode(db: AsyncSession, mode_name: str) -> str:
    await _mode_must_be_active(db, mode_name)
    row = (
        await db.execute(select(Setting).where(Setting.key == "active_mode"))
    ).scalar_one_or_none()
    if row is None:
        db.add(Setting(key="active_mode", value=mode_name))
    else:
        row.value = mode_name
    await db.flush()
    return mode_name


async def mint_token(
    db: AsyncSession,
    *,
    kind: str,
    mode: str,
    label: str | None = None,
) -> tuple[str, Token]:
    if kind not in {"card", "link"}:
        raise ValueError(f"invalid token kind: {kind}")
    await _mode_must_be_active(db, mode)

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
    row = (
        await db.execute(
            select(Token).where(Token.token_hash == _hash(raw)).where(Token.kind == "link")
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="token not found")
    if row.status != "active":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"token is {row.status}",
        )
    return row


async def mint_session_for_token(
    db: AsyncSession,
    *,
    token: Token,
) -> tuple[str, Visitor, VisitorSessionToken]:
    settings = get_settings()
    now = datetime.now(timezone.utc)

    visitor = Visitor()
    db.add(visitor)
    await db.flush()

    raw = _generate_raw()
    session_row = VisitorSessionToken(
        visitor_id=visitor.id,
        token_id=token.id,
        token_hash=_hash(raw),
        issued_at=now,
        expires_at=now + timedelta(days=settings.visitor_session_ttl_days),
    )
    db.add(session_row)

    token.tap_count = (token.tap_count or 0) + 1
    token.last_used_at = now

    await db.flush()
    return raw, visitor, session_row


async def revoke_existing_session_cookie(db: AsyncSession, raw_cookie: str | None) -> None:
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