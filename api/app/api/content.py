from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Mode, Reveal, Round, Token, Visitor, VisitorSessionToken
from ..schemas.content import ModeContentOut, RevealOut, RoundOut
from .deps import get_session_token_for_visitor


router = APIRouter(prefix="/content", tags=["content"])


@router.get("/{mode}", response_model=ModeContentOut)
async def get_mode_content(
    mode: str,
    request: Request,
    response: Response,
    visitor_session_token: tuple[Visitor, VisitorSessionToken, Token] = Depends(
        get_session_token_for_visitor
    ),
    db: AsyncSession = Depends(get_db),
) -> ModeContentOut:
    visitor, _session, token = visitor_session_token

    # Gating: requested mode must match the session's bound token's mode.
    if token.mode != mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="session not authorized for this mode",
        )

    mode_row = (await db.execute(select(Mode).where(Mode.name == mode))).scalar_one_or_none()
    if mode_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mode not found")

    rounds = (
        (await db.execute(select(Round).where(Round.mode_id == mode_row.id).order_by(Round.position)))
        .scalars()
        .all()
    )
    reveal = (
        await db.execute(select(Reveal).where(Reveal.mode_id == mode_row.id))
    ).scalar_one_or_none()
    if reveal is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"reveal missing for mode {mode!r}",
        )

    # ETag: derived from the latest updated_at across mode + rounds + reveal.
    # Cheap to compute, captures every content edit including reveal/links.
    latest = max(
        [mode_row.updated_at, reveal.updated_at, *[r.updated_at for r in rounds]]
    )
    etag = '"' + hashlib.sha256(f"{mode}:{latest.isoformat()}".encode()).hexdigest()[:32] + '"'

    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)  # type: ignore[return-value]

    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, max-age=300"

    return ModeContentOut(
        mode=mode,
        rounds=[
            RoundOut(id=r.slug, type=r.round_type, data=r.data) for r in rounds
        ],
        reveal=RevealOut(
            name=reveal.name, tagline=reveal.tagline, links=list(reveal.links or [])
        ),
        updated_at=latest,
    )