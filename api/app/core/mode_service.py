from __future__ import annotations

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Mode, Reveal, Round, Setting, Token, VisitorSessionToken
from ..schemas.admin import (
    CaptureRoundDataIn,
    ChoiceRoundDataIn,
    CreateModeRequest,
    ModeStatus,
)


_MODE_NAME_RESERVED = {"new", "create", "delete"}  # avoid path collisions


def _validate_round_data(round_type: str, data: dict) -> dict:
    """Dispatch round.data validation by round_type."""
    try:
        if round_type == "choice":
            return ChoiceRoundDataIn.model_validate(data).model_dump()
        if round_type == "capture":
            return CaptureRoundDataIn.model_validate(data).model_dump()
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"round_data_invalid": e.errors()},
        )
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"unknown round_type: {round_type}",
    )


def _validate_round_structure(rounds_in: list) -> None:
    """Enforce content-level invariants we want for every mode:
    - At least one choice round
    - Exactly one capture round, and it must be last
    - Slugs unique within the mode"""
    if not rounds_in:
        raise HTTPException(status_code=422, detail="rounds must not be empty")

    slugs = [r.slug for r in rounds_in]
    if len(slugs) != len(set(slugs)):
        raise HTTPException(status_code=422, detail="round slugs must be unique within a mode")

    capture_positions = [i for i, r in enumerate(rounds_in) if r.round_type == "capture"]
    if len(capture_positions) == 0:
        raise HTTPException(status_code=422, detail="a mode must include a capture round")
    if len(capture_positions) > 1:
        raise HTTPException(status_code=422, detail="a mode can have at most one capture round")
    if capture_positions[0] != len(rounds_in) - 1:
        raise HTTPException(
            status_code=422, detail="the capture round must be the last round"
        )

    choice_count = sum(1 for r in rounds_in if r.round_type == "choice")
    if choice_count < 1:
        raise HTTPException(
            status_code=422, detail="a mode must include at least one choice round"
        )


async def create_mode(db: AsyncSession, payload: CreateModeRequest) -> Mode:
    if payload.name in _MODE_NAME_RESERVED:
        raise HTTPException(status_code=422, detail=f"mode name {payload.name!r} is reserved")

    existing = (
        await db.execute(select(Mode).where(Mode.name == payload.name))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"mode {payload.name!r} already exists (status: {existing.status})",
        )

    _validate_round_structure(payload.rounds)
    # Validate every round's data shape before we touch the DB
    for r in payload.rounds:
        _validate_round_data(r.round_type, r.data)

    mode = Mode(name=payload.name, status="active")
    db.add(mode)
    await db.flush()

    for position, r in enumerate(payload.rounds):
        db.add(
            Round(
                mode_id=mode.id,
                position=position,
                round_type=r.round_type,
                slug=r.slug,
                data=r.data,
            )
        )

    db.add(
        Reveal(
            mode_id=mode.id,
            name=payload.reveal.name,
            tagline=payload.reveal.tagline,
            links=payload.reveal.links,
        )
    )

    await db.flush()
    return mode


async def transition_mode_status(
    db: AsyncSession, mode_name: str, new_status: ModeStatus
) -> Mode:
    mode = (
        await db.execute(select(Mode).where(Mode.name == mode_name))
    ).scalar_one_or_none()
    if mode is None:
        raise HTTPException(status_code=404, detail=f"mode not found: {mode_name}")

    if mode.status == new_status:
        return mode  # no-op

    # Refuse to deactivate/archive the currently active mode in settings
    if new_status in {"inactive", "archived"}:
        active_setting = (
            await db.execute(select(Setting).where(Setting.key == "active_mode"))
        ).scalar_one_or_none()
        if active_setting is not None and active_setting.value == mode_name:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"cannot change status of {mode_name!r}: it is the currently active mode. "
                    "switch settings.active_mode to another mode first."
                ),
            )

    mode.status = new_status
    await db.flush()
    return mode


async def purge_mode(db: AsyncSession, mode_name: str) -> None:
    """Hard delete. Refuses unless the mode is archived AND has no tokens
    or sessions referencing it. Conversations (Session C) will need an
    additional check + crypto-shred path."""
    mode = (
        await db.execute(select(Mode).where(Mode.name == mode_name))
    ).scalar_one_or_none()
    if mode is None:
        raise HTTPException(status_code=404, detail=f"mode not found: {mode_name}")

    if mode.status != "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"mode {mode_name!r} is {mode.status}; must be 'archived' before purge. "
                "set status='archived' first."
            ),
        )

    # Count anything still pointing at this mode
    token_count = (
        await db.execute(select(func.count(Token.id)).where(Token.mode == mode_name))
    ).scalar_one()
    if token_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"cannot purge {mode_name!r}: {token_count} token(s) still reference it. "
                "purge those first."
            ),
        )

    await db.delete(mode)
    # rounds + reveal cascade-delete via ondelete='CASCADE'
    await db.flush()


async def list_modes(
    db: AsyncSession, statuses: list[str] | None = None
) -> list[tuple[Mode, int]]:
    """Returns [(Mode, round_count), ...]. statuses filter is optional."""
    q = select(Mode, func.count(Round.id)).outerjoin(Round, Round.mode_id == Mode.id).group_by(Mode.id)
    if statuses:
        q = q.where(Mode.status.in_(statuses))
    q = q.order_by(Mode.name)
    return [(row[0], row[1]) for row in (await db.execute(q)).all()]


async def get_mode_detail(
    db: AsyncSession, mode_name: str
) -> tuple[Mode, list[Round], Reveal]:
    """Load a mode with all its rounds (ordered) and reveal."""
    mode = (
        await db.execute(select(Mode).where(Mode.name == mode_name))
    ).scalar_one_or_none()
    if mode is None:
        raise HTTPException(status_code=404, detail=f"mode not found: {mode_name}")

    rounds = list(
        (
            await db.execute(
                select(Round)
                .where(Round.mode_id == mode.id)
                .order_by(Round.position)
            )
        )
        .scalars()
        .all()
    )
    reveal = (
        await db.execute(select(Reveal).where(Reveal.mode_id == mode.id))
    ).scalar_one_or_none()
    if reveal is None:
        # Should never happen — reveal is created with the mode. Bubble up.
        raise HTTPException(
            status_code=500, detail=f"reveal missing for mode {mode_name!r}"
        )
    return mode, rounds, reveal


async def update_mode_content(
    db: AsyncSession,
    mode_name: str,
    rounds_in: list,  # list[RoundIn]
    reveal_in,        # RevealIn
) -> tuple[Mode, list[Round], Reveal]:
    """Replace the mode's rounds and reveal content atomically.

    Strategy: validate structure + per-round data, DELETE all existing
    rounds, INSERT the new ones. Reveal is updated in place (single row).
    Answers are decoupled from rounds at the schema level, so deleting
    round rows doesn't orphan anything the visitor UI depends on.

    Refreshes the visitor content ETag by touching Mode.updated_at
    explicitly — otherwise, if only rounds change and the reveal payload
    is byte-identical to what's stored, SQLAlchemy might not emit an
    UPDATE on either mode or reveal and the visitor would keep serving
    stale content.
    """
    mode = (
        await db.execute(select(Mode).where(Mode.name == mode_name))
    ).scalar_one_or_none()
    if mode is None:
        raise HTTPException(status_code=404, detail=f"mode not found: {mode_name}")

    _validate_round_structure(rounds_in)
    for r in rounds_in:
        _validate_round_data(r.round_type, r.data)

    # Wipe rounds. FK from other tables (answers) is null-on-delete or
    # doesn't exist — that's on the caller to guarantee, per the
    # "answers are decoupled" contract in the design notes.
    await db.execute(delete(Round).where(Round.mode_id == mode.id))

    for position, r in enumerate(rounds_in):
        db.add(
            Round(
                mode_id=mode.id,
                position=position,
                round_type=r.round_type,
                slug=r.slug,
                data=r.data,
            )
        )

    # Update reveal in place — single row per mode.
    reveal = (
        await db.execute(select(Reveal).where(Reveal.mode_id == mode.id))
    ).scalar_one_or_none()
    if reveal is None:
        raise HTTPException(
            status_code=500, detail=f"reveal missing for mode {mode_name!r}"
        )
    reveal.name = reveal_in.name
    reveal.tagline = reveal_in.tagline
    reveal.links = reveal_in.links

    # Explicit updated_at bump on the mode row — see docstring.
    from datetime import datetime, timezone
    mode.updated_at = datetime.now(timezone.utc)

    await db.flush()

    fresh_rounds = list(
        (
            await db.execute(
                select(Round)
                .where(Round.mode_id == mode.id)
                .order_by(Round.position)
            )
        )
        .scalars()
        .all()
    )
    return mode, fresh_rounds, reveal