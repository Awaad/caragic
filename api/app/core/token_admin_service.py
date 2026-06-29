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
) -> list[Token]:
    q = select(Token)
    if statuses:
        q = q.where(Token.status.in_(statuses))
    if mode is not None:
        q = q.where(Token.mode == mode)
    if kind is not None:
        q = q.where(Token.kind == kind)
    q = q.order_by(Token.created_at.desc())
    return list((await db.execute(q)).scalars().all())