from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Mode, Round, Submission, Token, Visitor, VisitorSessionToken
from ..schemas.visitor import SubmissionRequest
from .crypto import encrypt_field, hash_phone
from .phone import PhoneValidationError, parse_and_normalize
from .notifier import notify_submission_created


async def _load_choice_rounds(
    db: AsyncSession, mode_name: str
) -> dict[str, Round]:
    """Return {slug: Round} for every choice-type round in the mode.
    Raises 500 if the mode itself is missing (should be impossible — FK guards it)."""
    mode = (
        await db.execute(select(Mode).where(Mode.name == mode_name))
    ).scalar_one_or_none()
    if mode is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"mode missing: {mode_name}",
        )
    rounds = (
        await db.execute(
            select(Round).where(
                Round.mode_id == mode.id, Round.round_type == "choice"
            )
        )
    ).scalars().all()
    return {r.slug: r for r in rounds}


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


def _resolve_and_stamp(
    answers: list, rounds_by_slug: dict[str, Round]
) -> list[dict]:
    """Turn wire-format {round_id, option_id} into the snapshot shape stored
    on the row: {round_id, option_id, question, option_label, reveal_text}.

    This is where history stops being retroactive — once written, the answer
    survives any edit to the mode's content.

    Raises 422 if option_id doesn't exist in the round's data.options."""
    stamped: list[dict] = []
    for a in answers:
        round_row = rounds_by_slug[a.round_id]  # existence already validated
        options = round_row.data.get("options", [])
        question = round_row.data.get("question")

        matching = next((o for o in options if o.get("id") == a.option_id), None)
        if matching is None:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"unknown option_id {a.option_id!r} for round {a.round_id!r}"
                ),
            )

        stamped.append(
            {
                "round_id": a.round_id,
                "option_id": a.option_id,
                "question": question,
                "option_label": matching.get("label"),
                "reveal_text": matching.get("revealText"),
            }
        )
    return stamped


def _stamp_partial(answers: list, rounds_by_slug: dict[str, Round]) -> list[dict]:
    """Same as _resolve_and_stamp but permissive: unknown slugs/options land
    with null snapshots instead of 422. Used for declined outcomes where
    the visitor may have bailed mid-flow with partial or malformed answers."""
    stamped: list[dict] = []
    for a in answers:
        round_row = rounds_by_slug.get(a.round_id)
        if round_row is None:
            stamped.append(
                {
                    "round_id": a.round_id,
                    "option_id": a.option_id,
                    "question": None,
                    "option_label": None,
                    "reveal_text": None,
                }
            )
            continue
        options = round_row.data.get("options", [])
        matching = next((o for o in options if o.get("id") == a.option_id), None)
        stamped.append(
            {
                "round_id": a.round_id,
                "option_id": a.option_id,
                "question": round_row.data.get("question"),
                "option_label": matching.get("label") if matching else None,
                "reveal_text": matching.get("revealText") if matching else None,
            }
        )
    return stamped


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
    """Validate, resolve+stamp, encrypt, persist. Returns the saved row.
    Caller commits the transaction."""

    rounds_by_slug = await _load_choice_rounds(db, token.mode)
    expected = set(rounds_by_slug.keys())

    if payload.outcome == "submitted":
        if not payload.name:
            raise HTTPException(status_code=422, detail="name is required when submitting")
        if not payload.phone:
            raise HTTPException(status_code=422, detail="phone is required when submitting")

        try:
            e164 = parse_and_normalize(payload.phone)
        except PhoneValidationError as e:
            raise HTTPException(status_code=422, detail=str(e))

        _validate_answers_complete(payload.answers, expected)
        stamped_answers = _resolve_and_stamp(payload.answers, rounds_by_slug)

        name_ct: bytes | None = encrypt_field(payload.name)
        phone_ct: bytes | None = encrypt_field(e164)
        phone_fp: str | None = hash_phone(e164)
    else:
        # Declined — identity dropped on the floor, answers kept as-is
        # (permissive stamp: unknown slugs get null snapshots rather than
        # rejecting a decline for having malformed data).
        stamped_answers = _stamp_partial(payload.answers, rounds_by_slug)
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
        answers=stamped_answers,
    )
    db.add(row)
    await db.flush()
    
    # Fire-and-forget notification. Safe to call before commit — the task
    # runs in a separate session and will find the row after the request
    # completes and this transaction commits. (If commit fails, the task
    # sees no row and does nothing useful — which is fine; we'd rather
    # not notify about a submission that didn't actually persist.)
    notify_submission_created(
        submission_id=str(row.id),
        mode=row.mode,
        outcome=row.outcome,
        attempt_number=row.attempt_number,
        has_identity=row.name_encrypted is not None,
    )

    return row