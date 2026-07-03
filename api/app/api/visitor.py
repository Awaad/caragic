from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..core.rate_limit import enforce_tap_ip, enforce_link_ip

from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.token_service import (
    get_active_mode,
    mint_session_for_token,
    mint_token,
    resolve_link_token,
    revoke_existing_session_cookie,
    set_visitor_session_cookie,
)
from ..core.visitor_auth import VISITOR_COOKIE_NAME
from ..db import get_db

# These endpoints live at the root (no /api prefix) — they're user-facing URLs
# that get burnt into NFC cards or sent as links. We want them short.
router = APIRouter(tags=["visitor-entry"])


@router.get("/tap")
async def tap(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(enforce_tap_ip),
) -> RedirectResponse:
    """NFC card endpoint. Every tap mints a fresh card-kind token + new visitor
    + new session, then redirects into the app.

    Mode is read from settings.active_mode (owner-controlled).
    Existing session cookies are revoked — each tap is a fresh visitor."""
    mode = await get_active_mode(db)
    _, token = await mint_token(db, kind="card", mode=mode, label=None)
    raw_session, _visitor, _row = await mint_session_for_token(db, token=token)

    old_cookie = request.cookies.get(VISITOR_COOKIE_NAME)
    await revoke_existing_session_cookie(db, old_cookie)

    await db.commit()

    response = RedirectResponse(url="/", status_code=303)
    set_visitor_session_cookie(response, raw_session)
    return response


@router.get("/c/{token}")
async def consume_link(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(enforce_link_ip),
) -> RedirectResponse:
    """Pre-generated link endpoint. Resolves the token, mints a session bound
    to it, redirects into the app. Multi-use — each tap is a fresh visitor on
    the same token (tap_count tracks how many)."""
    token_row = await resolve_link_token(db, token)
    raw_session, _visitor, _row = await mint_session_for_token(db, token=token_row)

    old_cookie = request.cookies.get(VISITOR_COOKIE_NAME)
    await revoke_existing_session_cookie(db, old_cookie)

    await db.commit()

    response = RedirectResponse(url="/", status_code=303)
    set_visitor_session_cookie(response, raw_session)
    return response