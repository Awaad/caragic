from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.chat_connections import get_connection_manager
from ..core.chat_service import (
    _load_conversation_for_visitor,
    get_or_create_instant_conversation,
    list_messages,
    message_to_out_shape,
    send_message,
)
from ..api.deps import require_verified_session
from ..core.rate_limit import RateLimit, limit_by_session
from ..core.visitor_auth import (
    VERIFICATION_TTL,
    ResolvedSession,
    resolve_session_optional,
)
from ..core.notifier import notify_visitor_message
from ..db import get_db, SessionLocal 
from ..schemas.chat import (
    ConversationSummary,
    GetOrCreateConversationResponse,
    MessageListResponse,
    MessageOut,
    SendMessageRequest,
    SendMessageResponse,
    OwnerStatusOut,
)
from ..models import Submission

router = APIRouter(prefix="/visitor/conversations", tags=["visitor-chat"])


_MESSAGE_LIMIT = RateLimit("chat_send_session", max_count=30, window_seconds=60)


class VisitorReadRequest(BaseModel):
    message_ids: list[uuid.UUID]

class VisitorTypingRequest(BaseModel):
    is_typing: bool
    
    
def _conversation_to_summary(row) -> ConversationSummary:
    return ConversationSummary(
        id=row.id,
        kind=row.kind,
        status=row.status,
        created_at=row.created_at,
        last_message_at=row.last_message_at,
        unread_by_owner=row.unread_by_owner,
    )


@router.post("", response_model=GetOrCreateConversationResponse)
async def get_or_create_conversation(
    resolved: ResolvedSession = Depends(require_verified_session),
    db: AsyncSession = Depends(get_db),
) -> GetOrCreateConversationResponse:
    """Idempotent — returns the visitor's instant conversation, creating
    it lazily on first call."""
    convo = await get_or_create_instant_conversation(db, visitor=resolved.visitor)
    await db.commit()
    return GetOrCreateConversationResponse(
        conversation=_conversation_to_summary(convo)
    )


@router.get(
    "/{conversation_id}/messages", response_model=MessageListResponse
)
async def get_messages(
    conversation_id: uuid.UUID,
    resolved: ResolvedSession = Depends(require_verified_session),
    db: AsyncSession = Depends(get_db),
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before_id: Annotated[uuid.UUID | None, Query()] = None,
) -> MessageListResponse:
    """Load messages for a conversation, newest first. Cursor is the id
    of the oldest message you've already loaded — pass it as before_id."""
    await _load_conversation_for_visitor(
        db, conversation_id=conversation_id, visitor=resolved.visitor
    )
    rows, next_cursor = await list_messages(
        db, conversation_id=conversation_id, limit=limit, before_id=before_id
    )
    return MessageListResponse(
        messages=[MessageOut(**message_to_out_shape(m)) for m in rows],
        next_cursor=next_cursor,
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=SendMessageResponse,
    status_code=201,
)
async def post_message(
    conversation_id: uuid.UUID,
    payload: SendMessageRequest,
    resolved: ResolvedSession = Depends(require_verified_session),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    """Visitor sends a message. Rate-limited per session. Broadcasts to
    both the visitor's own WS (they see their own send land) and any
    listening admin WS."""
    await limit_by_session(str(resolved.session.id), _MESSAGE_LIMIT)

    convo = await _load_conversation_for_visitor(
        db, conversation_id=conversation_id, visitor=resolved.visitor
    )
    msg = await send_message(
        db, conversation=convo, sender="visitor", content=payload.content
    )
    
    submission = (
        await db.execute(
            select(Submission)
            .where(Submission.visitor_id == resolved.visitor.id)
            .where(Submission.outcome == "submitted")
            .order_by(Submission.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    visitor_name = None
    if submission and submission.name_encrypted:
        from ..core.crypto import decrypt_field
        visitor_name = decrypt_field(submission.name_encrypted)
        
    await db.commit()

    out = MessageOut(**message_to_out_shape(msg))

    manager = get_connection_manager()
    await manager.publish_message(
        convo.id,
        {
            "type": "message",
            "conversation_id": str(convo.id),
            "message": out.model_dump(mode="json"),
        },
    )
    
    notify_visitor_message(
        conversation_id=str(convo.id),
        visitor_name=visitor_name,
        preview=payload.content[:200],
    )

    return SendMessageResponse(message=out)



@router.post("/{conversation_id}/read")
async def visitor_read(
    conversation_id: uuid.UUID,
    payload: VisitorReadRequest,
    resolved: ResolvedSession = Depends(require_verified_session),
    db: AsyncSession = Depends(get_db),
) -> dict:
    convo = await _load_conversation_for_visitor(
        db, conversation_id=conversation_id, visitor=resolved.visitor
    )
    from ..core.chat_service import mark_messages_read
    marked = await mark_messages_read(
        db, conversation=convo, reader="visitor", message_ids=payload.message_ids
    )
    await db.commit()
    if marked:
        mgr = get_connection_manager()
        await mgr.publish_read(convo.id, "visitor", marked)
    return {"marked": len(marked)}


@router.post("/{conversation_id}/typing")
async def visitor_typing(
    conversation_id: uuid.UUID,
    payload: VisitorTypingRequest,
    resolved: ResolvedSession = Depends(require_verified_session),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _load_conversation_for_visitor(
        db, conversation_id=conversation_id, visitor=resolved.visitor
    )
    mgr = get_connection_manager()
    await mgr.publish_typing(conversation_id, "visitor", payload.is_typing)
    return {"ok": True}


@router.get("/status", response_model=OwnerStatusOut)
async def visitor_get_owner_status(
    resolved: ResolvedSession = Depends(require_verified_session),
    db: AsyncSession = Depends(get_db),
) -> OwnerStatusOut:
    from ..core.owner_status import load
    payload = await load(db)
    return OwnerStatusOut(
        status=payload.get("status", "offline"),
        updated_at=payload.get("updated_at"),
    )


# WebSocket 

@router.websocket("/{conversation_id}/stream")
async def stream(
    websocket: WebSocket,
    conversation_id: uuid.UUID,
) -> None:
    from ..core.visitor_auth import resolve_session_optional, VERIFICATION_TTL
    from datetime import datetime, timezone

    # Scoped session for auth + ownership only. Commit before releasing so the
    # last_seen_at UPDATE (from resolve_session) doesn't get rolled back — and,
    # more importantly, so the row lock it takes is released before we enter
    # the long-lived receive loop.
    async with SessionLocal() as db:
        resolved = await resolve_session_optional(websocket, db)
        if resolved is None:
            await db.rollback()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="unauth")
            return

        session = resolved.session
        if session.verified_phone_hash is None or session.verified_at is None:
            await db.rollback()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="unverified")
            return
        if datetime.now(timezone.utc) > session.verified_at + VERIFICATION_TTL:
            await db.rollback()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="verification expired")
            return

        try:
            await _load_conversation_for_visitor(
                db, conversation_id=conversation_id, visitor=resolved.visitor
            )
        except Exception:
            await db.rollback()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="not found")
            return

        await db.commit()   # ← releases the visitor row lock BEFORE the receive loop
    # session closed here

    await websocket.accept()
    manager = get_connection_manager()
    await manager.subscribe_visitor(websocket, conversation_id)

    import asyncio
    try:
        while True:
            recv = asyncio.create_task(websocket.receive_text())
            done, pending = await asyncio.wait(
                {recv}, timeout=25.0, return_when=asyncio.FIRST_COMPLETED
            )
            if recv in done:
                _ = recv.result()
            else:
                recv.cancel()
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await manager.unsubscribe(websocket)