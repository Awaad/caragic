from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Mode, Round, Submission, Token, Visitor, VisitorSessionToken
from ..schemas.visitor import SubmissionRequest
from .crypto import encrypt_field, hash_phone
from .phone import PhoneValidationError, parse_and_normalize


async def _choice_round_slugs(db: AsyncSession, mode_name: str) -> set[str]:
    """Slugs of every choice-type round in the mode, in any order."""
    mode = (
        await db.execute(select(Mode).where(Mode.name == mode_name))
    ).scalar_one_or_none()
    if mode is None:
        # Token references a mode that vanished. Same shape as content endpoint.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"mode missing: {mode_name}",
        )

    rows = (
        await db.execute(
            select(Round.slug).where(
                Round.mode_id == mode.id, Round.round_type == "choice"
            )
        )
    ).scalars().all()
    return set(rows)


def _validate_answers_complete(
    answers: list, expected_slugs: set[str]
) -> None:
    """Submitted outcome requires answers for every choice round, with no
    duplicates and no unknown round_ids. Order doesn't matter."""
    given_slugs = [a.round_id for a in answers]

    if len(given_slugs) != len(set(given_slugs)):
        raise HTTPException(
            status_code=422,
            detail="duplicate round_id in answers",
        )

    given_set = set(given_slugs)
    unknown = given_set - expected_slugs
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"unknown round_id(s) in answers: {sorted(unknown)}",
        )

    missing = expected_slugs - given_set
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"missing answer(s) for round(s): {sorted(missing)}",
        )


async def _next_attempt_number(db: AsyncSession, session_id) -> int:
    existing = (
        await db.execute(
            select(func.count(Submission.id)).where(
                Submission.session_id == session_id
            )
        )
    ).scalar_one()
    return int(existing) + 1


async def create_submission(
    db: AsyncSession,
    *,
    payload: SubmissionRequest,
    visitor: Visitor,
    session: VisitorSessionToken,
    token: Token,
) -> Submission:
    """Validate, encrypt, persist. Returns the saved row.

    Caller commits the transaction."""

    if payload.outcome == "submitted":
        if not payload.name:
            raise HTTPException(status_code=422, detail="name is required when submitting")
        if not payload.phone:
            raise HTTPException(status_code=422, detail="phone is required when submitting")

        try:
            e164 = parse_and_normalize(payload.phone)
        except PhoneValidationError as e:
            raise HTTPException(status_code=422, detail=str(e))

        expected = await _choice_round_slugs(db, token.mode)
        _validate_answers_complete(payload.answers, expected)

        name_ct: bytes | None = encrypt_field(payload.name)
        phone_ct: bytes | None = encrypt_field(e164)
        phone_fp: str | None = hash_phone(e164)
    else:
        # Declined  name/phone are dropped on the floor even if the client sent them.
        # The CHECK constraint enforces NULLs and we want to honor that intent server-side.
        name_ct = None
        phone_ct = None
        phone_fp = None

    attempt = await _next_attempt_number(db, session.id)

    row = Submission(
        visitor_id=visitor.id,
        session_id=session.id,
        token_id=token.id,
        mode=token.mode,
        outcome=payload.outcome,
        attempt_number=attempt,
        name_encrypted=name_ct,
        phone_encrypted=phone_ct,
        phone_hash=phone_fp,
        answers=[a.model_dump() for a in payload.answers],
        # status defaults to 'pending' server-side
    )
    db.add(row)
    await db.flush()
    return row