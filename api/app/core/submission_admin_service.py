"""Admin-side submission queries.

Two reads (list + detail) and one mutation (status transition). Detail
endpoint decrypts name and phone; list endpoint deliberately doesn't,
so the inbox view is a "metadata only" surface and PII access is an
explicit second action.
"""

from __future__ import annotations

import uuid as _uuid
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Submission
from .crypto import decrypt_field


SubmissionStatus = Literal["pending", "read", "archived"]


async def list_submissions(
    db: AsyncSession,
    *,
    mode: str | None = None,
    outcome: str | None = None,
    statuses: list[str] | None = None,
    limit: int = 50,
    before_id: _uuid.UUID | None = None,
) -> tuple[list[Submission], _uuid.UUID | None]:
    """Returns (rows, next_cursor). Ordered by created_at DESC, id DESC for
    stable pagination. `before_id` is the cursor  pass the last seen id to
    get the next page."""
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 200")

    q = select(Submission)
    if mode is not None:
        q = q.where(Submission.mode == mode)
    if outcome is not None:
        if outcome not in {"submitted", "declined"}:
            raise HTTPException(status_code=422, detail=f"invalid outcome: {outcome}")
        q = q.where(Submission.outcome == outcome)
    if statuses:
        for s in statuses:
            if s not in {"pending", "read", "archived"}:
                raise HTTPException(status_code=422, detail=f"invalid status: {s}")
        q = q.where(Submission.status.in_(statuses))

    if before_id is not None:
        cursor_row = (
            await db.execute(select(Submission).where(Submission.id == before_id))
        ).scalar_one_or_none()
        if cursor_row is None:
            raise HTTPException(status_code=422, detail="cursor not found")
        q = q.where(
            (Submission.created_at < cursor_row.created_at)
            | (
                (Submission.created_at == cursor_row.created_at)
                & (Submission.id < cursor_row.id)
            )
        )

    q = q.order_by(Submission.created_at.desc(), Submission.id.desc()).limit(limit + 1)
    rows = list((await db.execute(q)).scalars().all())

    next_cursor = rows[limit - 1].id if len(rows) > limit else None
    return rows[:limit], next_cursor


async def get_submission(db: AsyncSession, submission_id: _uuid.UUID) -> Submission:
    row = (
        await db.execute(select(Submission).where(Submission.id == submission_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="submission not found")
    return row


def decrypt_submission_pii(row: Submission) -> tuple[str | None, str | None]:
    """Returns (name, phone_e164). Both None on declined submissions."""
    if row.outcome != "submitted":
        return None, None
    name = decrypt_field(row.name_encrypted) if row.name_encrypted else None
    phone = decrypt_field(row.phone_encrypted) if row.phone_encrypted else None
    return name, phone


async def transition_submission_status(
    db: AsyncSession,
    submission_id: _uuid.UUID,
    new_status: SubmissionStatus,
) -> Submission:
    row = await get_submission(db, submission_id)
    if row.status == new_status:
        return row
    row.status = new_status
    await db.flush()
    return row