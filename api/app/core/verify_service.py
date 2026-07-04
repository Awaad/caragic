"""Session-level phone verification.

Two paths through check_verification_and_bind:
  1. Session cookie present with a submission → require phone_hash match,
     stamp session as verified.
  2. No cookie / no submission on cookie → look up submission by phone_hash,
     mint fresh session bound to that submission's token, stamp verified.

24h rolling window: verified_at + 24h. Fresh verifies extend the window;
they don't reset a fresh cookie.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Submission, Token, Visitor, VisitorSessionToken
from .crypto import hash_phone
from .otp import (
    OtpCheckStatus,
    OtpProviderError,
    check_verification,
    start_verification,
)
from .phone import PhoneValidationError, parse_and_normalize
from .token_service import mint_session_for_token, set_visitor_session_cookie


VERIFICATION_TTL = timedelta(hours=24)


async def start_phone_verification(phone_raw: str) -> str:
    """Normalize + hand off to provider. Returns verification_id.
    Raises 422 on bad phone, 503 on provider trouble."""
    try:
        e164 = parse_and_normalize(phone_raw)
    except PhoneValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    try:
        result = await start_verification(e164)
    except OtpProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="verification provider unavailable",
        )
    return result.verification_id


async def _find_most_recent_submitted_by_phone_hash(
    db: AsyncSession, phone_hash: str
) -> Submission | None:
    """For lost-cookie recovery: find a submission whose phone_hash matches.
    Only 'submitted' outcomes qualify — declined rows have no phone_hash."""
    row = (
        await db.execute(
            select(Submission)
            .where(Submission.phone_hash == phone_hash)
            .where(Submission.outcome == "submitted")
            .where(Submission.status != "erased")  # can't recover erased identity
            .order_by(Submission.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return row


async def check_verification_and_bind(
    db: AsyncSession,
    *,
    verification_id: str,
    code: str,
    current_session: VisitorSessionToken | None,
    current_visitor: Visitor | None,
    response: Response,
    phone_hint: str | None = None,
) -> tuple[VisitorSessionToken, datetime]:
    """Returns (session, verified_until). Sets cookie on response if a
    new session was minted.

    phone_hint: the phone the user typed at start-verify. Provider doesn't
    always echo the target back on check, so we retain it client-side and
    send it back for hashing. If dev-mode is on, the dev flow relies on
    this too.
    """
    print(f"CVAB phone_hint={phone_hint!r} type={type(phone_hint).__name__}", flush=True)
    if not phone_hint:
        # We need the phone to compute the hash for matching / lookup
        raise HTTPException(
            status_code=422,
            detail="phone required for verification check",
        )

    try:
        e164 = parse_and_normalize(phone_hint)
    except PhoneValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    try:
        result = await check_verification(verification_id, code)
    except OtpProviderError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="verification provider unavailable",
        )

    if result.status != OtpCheckStatus.SUCCESS:
        # Distinguish for the client — expired vs bad code matters for UX
        if result.status == OtpCheckStatus.EXPIRED:
            raise HTTPException(status_code=410, detail="verification expired")
        if result.status == OtpCheckStatus.BLOCKED:
            raise HTTPException(status_code=429, detail="too many attempts")
        raise HTTPException(status_code=400, detail="incorrect code")

    phone_hash = hash_phone(e164)
    now = datetime.now(timezone.utc)

    # --- Branch 1: existing session with a submission ---
    if current_session is not None and current_visitor is not None:
        # Does the visitor have any submission on this session?
        submission = (
            await db.execute(
                select(Submission)
                .where(Submission.session_id == current_session.id)
                .where(Submission.outcome == "submitted")
                .where(Submission.status != "erased")
                .order_by(Submission.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        if submission is not None:
            # Must match — this is the "session cookie proves I'm the submitter"
            # invariant. Mismatch = someone with a stolen cookie can't verify
            # against their own phone.
            if submission.phone_hash != phone_hash:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "this number doesn't match the one submitted. "
                        "contact the owner if you need to update it."
                    ),
                )

            current_session.verified_phone_hash = phone_hash
            current_session.verified_at = now
            return current_session, now + VERIFICATION_TTL

        # No submission on this session — treat like no cookie, fall through
        # to recovery. The current session gets replaced.

    # Branch 2: recovery — no cookie or no submission on cookie
    submission = await _find_most_recent_submitted_by_phone_hash(db, phone_hash)
    if submission is None:
        # Deliberately vague — don't leak "which phone numbers we know about"
        raise HTTPException(
            status_code=404,
            detail="no submission on record for this phone",
        )

    # Find the token that submission is bound to, mint a fresh session on it
    token = (
        await db.execute(
            select(Token).where(Token.id == submission.token_id)
        )
    ).scalar_one_or_none()
    if token is None:
        # Referential integrity says this can't happen — defensive
        raise HTTPException(status_code=500, detail="submission token missing")

    _raw, _visitor, new_session = await mint_session_for_token(db, token=token)
    new_session.verified_phone_hash = phone_hash
    new_session.verified_at = now

    set_visitor_session_cookie(response, _raw)
    return new_session, now + VERIFICATION_TTL


async def clear_verification(
    session: VisitorSessionToken,
) -> None:
    """Explicit /chat logout. Session stays alive; only the verification stamp
    is removed. Next chat load will require re-verify."""
    session.verified_phone_hash = None
    session.verified_at = None


def compute_verified_until(session: VisitorSessionToken) -> datetime | None:
    """Convenience — used by /api/content."""
    if session.verified_at is None:
        return None
    return session.verified_at + VERIFICATION_TTL