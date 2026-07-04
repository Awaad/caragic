from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Mode, Reveal, Round, Token, Visitor, VisitorSessionToken
from ..schemas.content import ModeContentOut, RevealOut, RoundOut
from ..core.verify_service import compute_verified_until
from .deps import get_session_token_for_visitor


router = APIRouter(prefix="/content", tags=["content"])


@router.get("", response_model=ModeContentOut)
async def get_content(
    request: Request,
    response: Response,
    visitor_session_token: tuple[Visitor, VisitorSessionToken, Token] = Depends(
        get_session_token_for_visitor
    ),
    db: AsyncSession = Depends(get_db),
) -> ModeContentOut:
    """Returns content for the session's bound mode. No path param — the
    session is the source of truth for which mode the visitor is in.

    401 if no valid session. The frontend uses this single endpoint as both
    'am I authorized?' and 'what do I show?' — one round trip on entry."""
    _visitor, _session, token = visitor_session_token
    verified_until = compute_verified_until(_session)
    mode_name = token.mode

    mode_row = (
        await db.execute(select(Mode).where(Mode.name == mode_name))
    ).scalar_one_or_none()
    if mode_row is None:
        # Token references a mode that no longer exists. Shouldn't happen — the
        # FK prevents it — but be defensive.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"mode missing for token: {mode_name}",
        )

    if mode_row.status != "active":
        # The mode was deactivated after this session was minted. Treat the
        # session as effectively expired — frontend will surface "card asleep".
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"mode {mode_name!r} is no longer active",
        )

    rounds = (
        (
            await db.execute(
                select(Round).where(Round.mode_id == mode_row.id).order_by(Round.position)
            )
        )
        .scalars()
        .all()
    )
    reveal = (
        await db.execute(select(Reveal).where(Reveal.mode_id == mode_row.id))
    ).scalar_one_or_none()
    if reveal is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"reveal missing for mode {mode_name!r}",
        )

    latest = max(
        [mode_row.updated_at, reveal.updated_at, *[r.updated_at for r in rounds]]
    )
    etag_source = (
        f"{mode_name}:{latest.isoformat()}:"
        f"{verified_until.isoformat() if verified_until else 'none'}"
    )
    etag = '"' + hashlib.sha256(etag_source.encode()).hexdigest()[:32] + '"'

    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)  # type: ignore[return-value]

    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, no-cache"

    return ModeContentOut(
        mode=mode_name,
        session_id=_session.id,
        rounds=[RoundOut(id=r.slug, type=r.round_type, data=r.data) for r in rounds],
        reveal=RevealOut(
            name=reveal.name, tagline=reveal.tagline, links=list(reveal.links or [])
        ),
        verified_until=verified_until,
        updated_at=latest,
    )