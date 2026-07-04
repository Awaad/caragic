from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.rate_limit import limit_by_ip, RateLimit
from ..core.verify_service import (
    check_verification_and_bind,
    clear_verification,
    start_phone_verification,
)
from ..core.visitor_auth import VISITOR_COOKIE_NAME, resolve_session_optional
from ..db import get_db
from ..models import Token, Visitor, VisitorSessionToken
from ..schemas.visitor import (
    VerifyCheckRequest,
    VerifyCheckResponse,
    VerifyStartRequest,
    VerifyStartResponse,
)
from ..config import get_settings


router = APIRouter(prefix="/visitor/verify", tags=["visitor-verify"])


# Rate limits inline — verify has its own bucket
_START_LIMIT = RateLimit("verify_start_ip", max_count=5, window_seconds=900)
_CHECK_LIMIT = RateLimit("verify_check_ip", max_count=10, window_seconds=900)


async def _rl_start(request: Request) -> None:
    await limit_by_ip(request, _START_LIMIT)


async def _rl_check(request: Request) -> None:
    await limit_by_ip(request, _CHECK_LIMIT)


@router.post("/start", response_model=VerifyStartResponse)
async def start(
    payload: VerifyStartRequest,
    _: None = Depends(_rl_start),
) -> VerifyStartResponse:
    """Send OTP to a phone. Returns a verification_id the client passes
    back to /check. Rate-limited per IP."""
    vid = await start_phone_verification(payload.phone)
    return VerifyStartResponse(verification_id=vid)


@router.post("/check", response_model=VerifyCheckResponse)
async def check(
    payload: VerifyCheckRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_rl_check),
) -> VerifyCheckResponse:
    """Verify OTP code. Two flows depending on session cookie presence.
    Body includes 'phone' so we can compute the hash for lookup/match."""
    # Optional session — recovery flow works without one
    resolved = await resolve_session_optional(request, db)
    current_session = resolved.session if resolved else None
    current_visitor = resolved.visitor if resolved else None
    current_token = None  # token not needed for check; we look it up via submission

    # Phone comes back through the payload — see verify_service docstring
    phone_hint = payload.phone,

    session, verified_until = await check_verification_and_bind(
        db,
        verification_id=payload.verification_id,
        code=payload.code,
        current_session=current_session,
        current_visitor=current_visitor,
        response=response,
        phone_hint=phone_hint,
    )
    await db.commit()

    return VerifyCheckResponse(verified=True, verified_until=verified_until)


@router.post("/logout")
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Explicit /chat logout — clears verification stamp on the session.
    Session cookie itself is preserved (they can still see the reveal)."""
    resolved = await resolve_session_optional(
        request, db, cookie_name=VISITOR_COOKIE_NAME
    )
    if resolved is not None:
        await clear_verification(resolved.session)
        await db.commit()
    return {"ok": True}