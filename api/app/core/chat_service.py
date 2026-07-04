"""Instant chat foundation.

Design notes:
- Ownership check is scoped by visitor_id on visitor endpoints, by the
  admin dep on admin endpoints. No cross-visitor leakage possible.
- Cursor pagination on message.id (UUID v7 = chronological). WHERE id < cursor
  ORDER BY id DESC LIMIT n+1. Same shape as submissions/tokens.
- All content is AES-GCM encrypted at rest. Decryption is a per-request cost.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Conversation, Message, Submission, Visitor
from .crypto import decrypt_field, encrypt_field


async def get_or_create_instant_conversation(
    db: AsyncSession, *, visitor: Visitor
) -> Conversation:
    """One instant conversation per visitor. The unique partial index
    on (visitor_id) WHERE kind='instant' enforces this at the DB level."""
    row = (
        await db.execute(
            select(Conversation)
            .where(Conversation.visitor_id == visitor.id)
            .where(Conversation.kind == "instant")
        )
    ).scalar_one_or_none()
    if row is not None:
        return row

    # Bind to the visitor's most recent submitted submission (if any).
    # Declined-only visitors currently can't reach here — verify requires
    # a submitted row — but the FK is nullable for future flexibility.
    submission = (
        await db.execute(
            select(Submission)
            .where(Submission.visitor_id == visitor.id)
            .where(Submission.outcome == "submitted")
            .order_by(Submission.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    row = Conversation(
        visitor_id=visitor.id,
        submission_id=submission.id if submission else None,
        kind="instant",
        status="open",
    )
    db.add(row)
    try:
        # flush to force the INSERT + hit the unique constraint now, not later
        await db.flush()
    except IntegrityError:
        # Someone else won the race. Roll back the failed insert, re-select
        # the winner. Don't leak the IntegrityError to the caller — the caller
        # asked for "get or create" and we can honor that promise.
        await db.rollback()
        winner = (
            await db.execute(
                select(Conversation)
                .where(Conversation.visitor_id == visitor.id)
                .where(Conversation.kind == "instant")
            )
        ).scalar_one_or_none()
        if winner is None:
            # Truly unexpected — the constraint fired but nothing is there.
            # Bubble up so we see it in logs.
            raise
        return winner

    return row


async def _load_conversation_for_visitor(
    db: AsyncSession, *, conversation_id: uuid.UUID, visitor: Visitor
) -> Conversation:
    """Fetch + ownership check. Anything else is 404 (don't leak existence)."""
    row = (
        await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
    ).scalar_one_or_none()
    if row is None or row.visitor_id != visitor.id:
        raise HTTPException(status_code=404, detail="conversation not found")
    return row


async def load_conversation_for_owner(
    db: AsyncSession, *, conversation_id: uuid.UUID
) -> Conversation:
    """Admin doesn't have ownership constraints — the auth dep already gates."""
    row = (
        await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    return row


async def list_messages(
    db: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    limit: int = 50,
    before_id: uuid.UUID | None = None,
) -> tuple[list[Message], uuid.UUID | None]:
    """(rows, next_cursor). Newest-first. UUID v7 means ORDER BY id DESC
    is chronological. Cursor is 'id < before_id' — no compound key needed."""
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=422, detail="limit must be 1..200")

    q = select(Message).where(Message.conversation_id == conversation_id)
    if before_id is not None:
        q = q.where(Message.id < before_id)
    q = q.order_by(Message.id.desc()).limit(limit + 1)
    rows = list((await db.execute(q)).scalars().all())

    next_cursor = rows[limit - 1].id if len(rows) > limit else None
    return rows[:limit], next_cursor


def message_to_out_shape(m: Message) -> dict:
    """Serialize to the API response shape. Decrypts content."""
    return {
        "id": m.id,
        "conversation_id": m.conversation_id,
        "sender": m.sender,
        "content_type": m.content_type,
        "content": decrypt_field(m.content_encrypted),
        "content_metadata": m.content_metadata or {},
        "created_at": m.created_at,
    }


async def send_message(
    db: AsyncSession,
    *,
    conversation: Conversation,
    sender: str,
    content: str,
) -> Message:
    """Insert an encrypted message + bump conversation state. Returns the
    Message row with populated id/created_at."""
    if sender not in ("visitor", "owner", "ai", "system"):
        raise HTTPException(status_code=422, detail="invalid sender")

    content = content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="content required")
    if len(content) > 2000:
        raise HTTPException(status_code=422, detail="content too long (max 2000)")

    now = datetime.now(timezone.utc)
    msg = Message(
        conversation_id=conversation.id,
        sender=sender,
        content_type="text",
        content_encrypted=encrypt_field(content),
        content_metadata={},
    )
    db.add(msg)

    # Bump conversation state
    conversation.last_message_at = now
    conversation.updated_at = now
    if sender == "visitor":
        conversation.unread_by_owner = True
    elif sender == "owner":
        # Owner replied — clear their own unread flag (they just interacted)
        conversation.unread_by_owner = False

    await db.flush()
    return msg