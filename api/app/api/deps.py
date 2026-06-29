from __future__ import annotations

from fastapi import Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..core.visitor_auth import (
    VISITOR_COOKIE_NAME,
    resolve_session,
)
from ..db import get_db
from ..models import Token, Visitor, VisitorSessionToken


def _set_visitor_cookie(response: Response, raw_token: str) -> None:
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


async def get_current_visitor(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> tuple[Visitor, VisitorSessionToken]:
    """Resolves the visitor from the cookie, rotates if needed, sets fresh cookie on rotation.

    Raises 401 if no cookie / invalid / expired / revoked.
    Use require_visitor_session for the dependency-style call site.
    """
    raw = request.cookies.get(VISITOR_COOKIE_NAME)
    if raw is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="no visitor session")
    visitor, active_row, new_raw = await resolve_session(db, raw)
    await db.commit()
    if new_raw is not None:
        _set_visitor_cookie(response, new_raw)
    return visitor, active_row


async def get_session_token_for_visitor(
    visitor_and_session: tuple[Visitor, VisitorSessionToken] = Depends(get_current_visitor),
    db: AsyncSession = Depends(get_db),
) -> tuple[Visitor, VisitorSessionToken, Token]:
    """Same as get_current_visitor, but also resolves the bound Token row.
    Useful for endpoints that need to gate on the token's mode."""
    visitor, session_row = visitor_and_session
    token = (
        await db.execute(select(Token).where(Token.id == session_row.token_id))
    ).scalar_one_or_none()
    if token is None or token.revoked or not token.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="token no longer valid"
        )
    return visitor, session_row, token