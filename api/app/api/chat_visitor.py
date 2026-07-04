from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
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
from ..db import get_db
from ..schemas.chat import (
    ConversationSummary,
    GetOrCreateConversationResponse,
    MessageListResponse,
    MessageOut,
    SendMessageRequest,
    SendMessageResponse,
)


router = APIRouter(prefix="/visitor/conversations", tags=["visitor-chat"])


_MESSAGE_LIMIT = RateLimit("chat_send_session", max_count=30, window_seconds=60)


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

    return SendMessageResponse(message=out)


# WebSocket 

@router.websocket("/{conversation_id}/stream")
async def stream(
    websocket: WebSocket,
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Receive-only stream. Auth via cookie (WS upgrade includes cookies).
    Sends are still HTTP POST — simpler auth surface, better replayability
    on disconnect.

    Sends a heartbeat every 25s to keep proxies from timing out; visitor
    doesn't need to respond."""
    # Manual auth — Depends() on WebSocket routes doesn't gate connection
    from ..core.visitor_auth import resolve_session_optional, VERIFICATION_TTL
    from datetime import datetime, timezone

    resolved = await resolve_session_optional(websocket, db)
    if resolved is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="unauth")
        return

    session = resolved.session
    if session.verified_phone_hash is None or session.verified_at is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="unverified")
        return
    if datetime.now(timezone.utc) > session.verified_at + VERIFICATION_TTL:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="verification expired")
        return

    # Ownership check
    try:
        await _load_conversation_for_visitor(
            db, conversation_id=conversation_id, visitor=resolved.visitor
        )
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="not found")
        return

    await websocket.accept()
    manager = get_connection_manager()
    await manager.subscribe_visitor(websocket, conversation_id)

    import asyncio
    try:
        while True:
            # We don't expect client messages; if they send one, ignore.
            # asyncio.wait lets us multiplex a heartbeat.
            recv = asyncio.create_task(websocket.receive_text())
            done, pending = await asyncio.wait(
                {recv}, timeout=25.0, return_when=asyncio.FIRST_COMPLETED
            )
            if recv in done:
                # Consumed; loop
                _ = recv.result()
            else:
                # Timeout — send heartbeat, cancel the pending recv
                recv.cancel()
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    except Exception:
        # any other error → disconnect
        pass
    finally:
        await manager.unsubscribe(websocket)