from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.visitor_auth import (
    VISITOR_COOKIE_NAME,
    create_visitor_with_session,
    resolve_session,
)
from ..db import get_db
from ..schemas import VisitorSessionResponse
from .deps import _set_visitor_cookie

router = APIRouter(prefix="/visitor", tags=["visitor"])


@router.post("/session", response_model=VisitorSessionResponse)
async def init_session(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> VisitorSessionResponse:
    """Idempotent.

    - If no cookie OR cookie is invalid/expired: create a new visitor + token,
      set the cookie, return new session info.
    - If cookie is valid: return existing session info, rotating + reissuing
      the cookie if the rotate threshold has passed.
    """
    raw = request.cookies.get(VISITOR_COOKIE_NAME)
    rotated = False

    if raw is not None:
        try:
            visitor, active_row, new_raw = await resolve_session(db, raw)
            if new_raw is not None:
                _set_visitor_cookie(response, new_raw)
                rotated = True
            await db.commit()
            return VisitorSessionResponse(
                visitor_id=visitor.id,
                issued_at=active_row.issued_at,
                expires_at=active_row.expires_at,
                rotated=rotated,
            )
        except HTTPException as e:
            if e.status_code != 401:
                raise
            await db.rollback()

    raw_new, row, visitor = await create_visitor_with_session(db)
    await db.commit()
    _set_visitor_cookie(response, raw_new)
    return VisitorSessionResponse(
        visitor_id=visitor.id,
        issued_at=row.issued_at,
        expires_at=row.expires_at,
        rotated=False,
    )