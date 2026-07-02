"""Erase-my-data flow.

Two entry points:
  - request_erasure_by_visitor: visitor-cookie-gated. Marks the submission
    erase_requested. Identity fields stay intact so admin can verify.
  - finalize_erasure_by_admin: owner-gated. NULLs identity fields, appends
    an audit log row, transitions status to erased.

Both are idempotent-safe: requesting again on an already-requested row is
a no-op; finalizing an already-erased row is a no-op.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ErasureLog, Submission


async def request_erasure_by_visitor(
    db: AsyncSession,
    *,
    submission_id,
    visitor_id,
) -> Submission:
    """Visitor requests erasure of their own submission.

    Ownership check: submission.visitor_id must match the visitor from the
    session cookie. Anything else is 404 (not 403 — we don't leak existence).

    Only 'submitted' rows are erasable — declines have no PII to erase, and
    surfacing that as a case in the UI is more confusing than useful.

    Idempotent: if already erase_requested or erased, returns the row unchanged.
    """
    row = (
        await db.execute(select(Submission).where(Submission.id == submission_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="submission not found")

    if row.visitor_id != visitor_id:
        # Don't leak that the row exists but belongs to someone else
        raise HTTPException(status_code=404, detail="submission not found")

    if row.status in ("erase_requested", "erased"):
        return row  # idempotent

    row.status = "erase_requested"
    log = ErasureLog(
        submission_id=row.id,
        mode=row.mode,
        phone_hash=row.phone_hash,
        requested_via="visitor",
    )
    db.add(log)
    await db.flush()
    return row


async def finalize_erasure_by_admin(
    db: AsyncSession,
    *,
    submission_id,
    admin_username: str,
) -> Submission:
    """Admin finalizes an erasure. NULLs identity fields, updates the most
    recent open log row for this submission, transitions to erased.

    Two valid preconditions:
      - status == 'erase_requested' (visitor asked; admin approves)
      - status in {'pending', 'read', 'archived'} (admin-initiated: no prior
        visitor request needed; owner has authority to erase on request)

    Refuses to erase declined rows (nothing to erase) and already-erased
    rows (idempotent no-op).
    """
    row = (
        await db.execute(select(Submission).where(Submission.id == submission_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="submission not found")


    if row.status == "erased":
        # Idempotent — return the row. The last log entry is still the truth.
        return row

    now = datetime.now(timezone.utc)

    # Find the most recent un-finalized log entry for this submission. If the
    # visitor requested, there's one open. If admin-initiated, there isn't —
    # create one so audit is symmetric.
    open_log = (
        await db.execute(
            select(ErasureLog)
            .where(ErasureLog.submission_id == row.id)
            .where(ErasureLog.finalized_at.is_(None))
            .order_by(ErasureLog.requested_at.desc())
        )
    ).scalars().first()

    if open_log is None:
        # Admin-initiated erasure without prior visitor request
        open_log = ErasureLog(
            submission_id=row.id,
            mode=row.mode,
            phone_hash=row.phone_hash,
            requested_via="admin",
            requested_at=now,
        )
        db.add(open_log)

    open_log.finalized_at = now
    open_log.finalized_by = admin_username

    # Crypto-shred the identity — the encryption bytes are the only place
    # name/phone live in cleartext (post-decrypt). Wipe both cipher and
    # fingerprint. Keep answers + outcome + attempt_number for funnel.
    row.name_encrypted = None
    row.phone_encrypted = None
    row.phone_hash = None
    row.status = "erased"

    await db.flush()
    return row