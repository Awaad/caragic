import uuid as _uuid
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Token, VisitorSessionToken
from ..schemas.admin import TokenStatus


async def transition_token_status(
    db: AsyncSession,
    token_id: str,
    new_status: TokenStatus,
    reason: str | None,
) -> Token:
    token = (
        await db.execute(select(Token).where(Token.id == token_id))
    ).scalar_one_or_none()
    if token is None:
        raise HTTPException(status_code=404, detail="token not found")

    if token.status == "revoked" and new_status != "revoked":
        # Revoked is terminal — can't un-revoke. Mint a new token instead.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="revoked tokens cannot be reactivated; mint a new token",
        )

    if token.status == new_status:
        return token

    now = datetime.now(timezone.utc)
    if new_status == "revoked":
        token.revoked_at = now
        token.revoked_reason = reason
        # Also revoke every session bound to this token
        sessions = (
            await db.execute(
                select(VisitorSessionToken).where(
                    VisitorSessionToken.token_id == token.id
                ).where(VisitorSessionToken.revoked.is_(False))
            )
        ).scalars().all()
        for s in sessions:
            s.revoked = True

    token.status = new_status
    await db.flush()
    return token


async def purge_token(db: AsyncSession, token_id: str) -> None:
    """Hard delete. Cascade-deletes all bound sessions (FK has ondelete RESTRICT
    so we delete sessions manually first)."""
    token = (
        await db.execute(select(Token).where(Token.id == token_id))
    ).scalar_one_or_none()
    if token is None:
        raise HTTPException(status_code=404, detail="token not found")

    if token.status != "revoked":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"token is {token.status}; must be 'revoked' before purge",
        )

    # Delete bound sessions first, flush so the FK constraint sees them gone
    sessions = (
        await db.execute(
            select(VisitorSessionToken).where(VisitorSessionToken.token_id == token.id)
        )
    ).scalars().all()
    for s in sessions:
        await db.delete(s)
    await db.flush()  

    await db.delete(token)
    await db.flush()


async def list_tokens(
    db: AsyncSession,
    statuses: list[str] | None = None,
    mode: str | None = None,
    kind: str | None = None,
    limit: int = 50,
    before_id: _uuid.UUID | None = None,
) -> tuple[list[Token], _uuid.UUID | None]:
    """(rows, next_cursor). Ordered by created_at DESC, id DESC for stable
    pagination when timestamps collide (fast test loops)."""
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 200")

    q = select(Token)
    if statuses:
        q = q.where(Token.status.in_(statuses))
    if mode is not None:
        q = q.where(Token.mode == mode)
    if kind is not None:
        q = q.where(Token.kind == kind)

    if before_id is not None:
        cursor_row = (
            await db.execute(select(Token).where(Token.id == before_id))
        ).scalar_one_or_none()
        if cursor_row is None:
            raise HTTPException(status_code=422, detail="cursor not found")
        q = q.where(
            (Token.created_at < cursor_row.created_at)
            | (
                (Token.created_at == cursor_row.created_at)
                & (Token.id < cursor_row.id)
            )
        )

    q = q.order_by(Token.created_at.desc(), Token.id.desc()).limit(limit + 1)
    rows = list((await db.execute(q)).scalars().all())

    next_cursor = rows[limit - 1].id if len(rows) > limit else None
    return rows[:limit], next_cursor