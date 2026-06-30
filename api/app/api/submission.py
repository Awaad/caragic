"""POST /api/visitor/submissions  visitor-gated submission endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.submission_service import create_submission
from ..db import get_db
from ..models import Token, Visitor, VisitorSessionToken
from ..schemas.visitor import SubmissionRequest, SubmissionResponse
from .deps import get_session_token_for_visitor


router = APIRouter(prefix="/visitor", tags=["visitor"])


@router.post(
    "/submissions",
    response_model=SubmissionResponse,
    status_code=201,
)
async def post_submission(
    payload: SubmissionRequest,
    visitor_session_token: tuple[Visitor, VisitorSessionToken, Token] = Depends(
        get_session_token_for_visitor
    ),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    """Record a flow completion. `outcome='submitted'` carries name + phone +
    full answers; `outcome='declined'` carries only whatever answers the visitor
    managed before bailing (and is fire-and-forget from the client's perspective).

    Multiple submissions per session are allowed — `attempt_number` is set
    server-side based on how many submissions this session already has."""
    visitor, session, token = visitor_session_token
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