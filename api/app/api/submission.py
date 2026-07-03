"""POST /api/visitor/submissions  visitor-gated submission endpoint."""

from __future__ import annotations
import uuid

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from ..config import get_settings
from ..core.rate_limit import (
    enforce_submission_ip,
    enforce_submission_session,
    enforce_erase_session,
)
from ..core.submission_service import create_submission
from ..core.erasure_service import request_erasure_by_visitor
from ..core.token_service import revoke_existing_session_cookie
from ..core.visitor_auth import VISITOR_COOKIE_NAME
from ..db import get_db
from ..models import Token, Visitor, VisitorSessionToken
from ..schemas.visitor import SubmissionRequest, SubmissionResponse, EraseRequestResponse
from .deps import get_session_token_for_visitor


router = APIRouter(prefix="/visitor", tags=["visitor"])


@router.post(
    "/submissions",
    response_model=SubmissionResponse,
    status_code=201,
)
async def post_submission(
    payload: SubmissionRequest,
    request: Request,
    visitor_session_token: tuple[Visitor, VisitorSessionToken, Token] = Depends(
        get_session_token_for_visitor
    ),
    db: AsyncSession = Depends(get_db),
    _ip: None = Depends(enforce_submission_ip),
) -> SubmissionResponse:
    """Record a flow completion. `outcome='submitted'` carries name + phone +
    full answers; `outcome='declined'` carries only whatever answers the visitor
    managed before bailing (and is fire-and-forget from the client's perspective).

    Multiple submissions per session are allowed — `attempt_number` is set
    server-side based on how many submissions this session already has."""
    visitor, session, token = visitor_session_token
    # Session limit AFTER IP limit — IP is the coarser filter, cheaper key
    await enforce_submission_session(str(session.id))
    row = await create_submission(
        db,
        payload=payload,
        visitor=visitor,
        session=session,
        token=token,
    )
    await db.commit()
    return SubmissionResponse(
        id=row.id,
        outcome=row.outcome,
        attempt_number=row.attempt_number,
        created_at=row.created_at,
    )
    
    
@router.post(
    "/submissions/{submission_id}/erase-request",
    response_model=EraseRequestResponse,
)
async def request_erasure(
    submission_id: uuid.UUID,
    request: Request,
    response: Response,
    visitor_session_token: tuple[Visitor, VisitorSessionToken, Token] = Depends(
        get_session_token_for_visitor
    ),
    db: AsyncSession = Depends(get_db),
) -> EraseRequestResponse:
    """Visitor-side erase request. Cookie-gated. Marks the submission
    'erase_requested'; admin finalizes separately.

    Ownership enforced: the visitor cookie's visitor_id must match the
    submission's visitor_id. Anything else is 404."""
    visitor, session, _token = visitor_session_token
    # Session-only limit here  erase is small in volume, IP limit is overkill
    # and would double-count against the general per-IP submission bucket if
    # you ever move erase there.
    await enforce_erase_session(str(session.id))
    
    await request_erasure_by_visitor(
        db,
        submission_id=submission_id,
        visitor_id=visitor.id,
    )
     # === Session revocation on erase (the fold-in from the discussion) ===
    # Visitor asked to be erased. Don't leave them holding a live token.
    old_cookie = request.cookies.get(VISITOR_COOKIE_NAME)
    await revoke_existing_session_cookie(db, old_cookie)
    
    await db.commit()
    settings = get_settings()
    response.delete_cookie(
        key=VISITOR_COOKIE_NAME,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )
    return EraseRequestResponse(
        accepted=True,
        message=(
            "your data is queued for erasure."
            "shortly. this device is now signed out."
        ),
    )