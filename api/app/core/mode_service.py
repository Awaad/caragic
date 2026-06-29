from __future__ import annotations

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import func, select
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