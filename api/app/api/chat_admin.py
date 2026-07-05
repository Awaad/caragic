from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.chat_connections import get_connection_manager
from ..core.chat_service import (
    list_conversations_for_admin,
    load_conversation_for_owner,
    list_messages,
    message_to_out_shape,
    mark_messages_read,
    send_message,
)
from ..core.owner_auth import get_current_owner
from ..core.owner_status import (
    load as load_owner_status,
    set_status as set_owner_status,
    heartbeat as owner_heartbeat,
)
from ..core.crypto import decrypt_field
from ..db import get_db, SessionLocal
from ..models import Message, Submission
from ..schemas.chat import (
    AdminConversationListResponse,
    AdminConversationSummary,
    MessageListResponse,
    MessageOut,
    OwnerStatusIn,
    OwnerStatusOut,
    ReadReceiptRequest,
    SendMessageRequest,
    SendMessageResponse,
    ToggleReceiptsRequest,
)


router = APIRouter(prefix="/admin/chat", tags=["admin-chat"])

ws_router = APIRouter(prefix="/admin/chat", tags=["admin-chat-ws"])


def _preview(text: str, n: int = 80) -> str:
    text = text.replace("\n", " ").strip()
    return text if len(text) <= n else text[: n - 1] + "…"


async def _to_admin_summary(db: AsyncSession, c) -> AdminConversationSummary:
    # last message preview
    last = (
        await db.execute(
            select(Message)
            .where(Message.conversation_id == c.id)
            .order_by(Message.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    preview = _preview(decrypt_field(last.content_encrypted)) if last else None
    sender = last.sender if last else None
    
    visitor_name: str | None = None
    if c.submission_id is not None:
        sub = (
            await db.execute(
                select(Submission).where(Submission.id == c.submission_id)
            )
        ).scalar_one_or_none()
        if sub is not None and sub.name_encrypted:
            visitor_name = decrypt_field(sub.name_encrypted)
            
    return AdminConversationSummary(
        id=c.id,
        visitor_id=c.visitor_id,
        kind=c.kind,
        status=c.status,
        created_at=c.created_at,
        last_message_at=c.last_message_at,
        unread_by_owner=c.unread_by_owner,
        owner_receipts_enabled=c.owner_receipts_enabled,
        last_message_preview=preview,
        last_message_sender=sender,
        visitor_name=visitor_name,
        submission_id=c.submission_id,
    )


@router.get("/conversations", response_model=AdminConversationListResponse)
async def list_convos(
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
    unread_only: Annotated[bool, Query()] = False,
) -> AdminConversationListResponse:
    rows = await list_conversations_for_admin(db, unread_only=unread_only)
    summaries = [await _to_admin_summary(db, c) for c in rows]
    return AdminConversationListResponse(conversations=summaries)


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListResponse)
async def admin_get_messages(
    conversation_id: uuid.UUID,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before_id: Annotated[uuid.UUID | None, Query()] = None,
) -> MessageListResponse:
    await load_conversation_for_owner(db, conversation_id=conversation_id)
    rows, next_cursor = await list_messages(
        db, conversation_id=conversation_id, limit=limit, before_id=before_id
    )
    return MessageListResponse(
        messages=[MessageOut(**message_to_out_shape(m)) for m in rows],
        next_cursor=next_cursor,
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SendMessageResponse,
    status_code=201,
)
async def admin_send(
    conversation_id: uuid.UUID,
    payload: SendMessageRequest,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    convo = await load_conversation_for_owner(db, conversation_id=conversation_id)
    msg = await send_message(db, conversation=convo, sender="owner", content=payload.content)
    await db.commit()

    out = MessageOut(**message_to_out_shape(msg))
    mgr = get_connection_manager()
    await mgr.publish_message(
        convo.id,
        {"type": "message", "conversation_id": str(convo.id), "message": out.model_dump(mode="json")},
    )
    return SendMessageResponse(message=out)


@router.post("/conversations/{conversation_id}/read")
async def admin_read(
    conversation_id: uuid.UUID,
    payload: ReadReceiptRequest,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> dict:
    convo = await load_conversation_for_owner(db, conversation_id=conversation_id)
    marked = await mark_messages_read(
        db, conversation=convo, reader="owner", message_ids=payload.message_ids
    )
    await db.commit()
    if marked:
        mgr = get_connection_manager()
        await mgr.publish_read(convo.id, "owner", marked)
    return {"marked": len(marked)}


@router.post("/conversations/{conversation_id}/typing")
async def admin_typing(
    conversation_id: uuid.UUID,
    is_typing: Annotated[bool, Query()],
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await load_conversation_for_owner(db, conversation_id=conversation_id)
    mgr = get_connection_manager()
    await mgr.publish_typing(conversation_id, "owner", is_typing)
    return {"ok": True}


@router.post("/conversations/{conversation_id}/receipts", response_model=AdminConversationSummary)
async def toggle_receipts(
    conversation_id: uuid.UUID,
    payload: ToggleReceiptsRequest,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> AdminConversationSummary:
    convo = await load_conversation_for_owner(db, conversation_id=conversation_id)
    convo.owner_receipts_enabled = payload.enabled
    await db.commit()
    return await _to_admin_summary(db, convo)


# Owner status

@router.get("/status", response_model=OwnerStatusOut)
async def get_status(
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> OwnerStatusOut:
    payload = await load_owner_status(db)
    return OwnerStatusOut(
        status=payload.get("status", "offline"),
        updated_at=payload.get("updated_at"),
    )


@router.put("/status", response_model=OwnerStatusOut)
async def put_status(
    payload: OwnerStatusIn,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> OwnerStatusOut:
    result = await set_owner_status(db, payload.status)
    await db.commit()
    mgr = get_connection_manager()
    await mgr.publish_status({"status": result["status"], "updated_at": result["updated_at"]})
    return OwnerStatusOut(status=result["status"], updated_at=result.get("updated_at"))


# Admin WS stream 

@ws_router.websocket("/stream")
async def admin_stream(
    websocket: WebSocket,
) -> None:
    # Cookie auth — reuse the owner cookie
    from ..core.owner_auth import decode_admin_token
    from ..config import get_settings
    settings = get_settings()

    cookie = websocket.cookies.get(settings.admin_cookie_name)
    if not cookie:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="unauth")
        return
    try:
        decode_admin_token(cookie)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="unauth")
        return

    await websocket.accept()
    mgr = get_connection_manager()
    await mgr.subscribe_admin(websocket)

    # Initial heartbeat in a scoped session
    async with SessionLocal() as db:
        await owner_heartbeat(db)
        await db.commit()

    import asyncio
    try:
        while True:
            recv = asyncio.create_task(websocket.receive_text())
            done, pending = await asyncio.wait(
                {recv}, timeout=30.0, return_when=asyncio.FIRST_COMPLETED
            )
            if recv in done:
                _ = recv.result()  # client heartbeat / ping, ignored content-wise
            else:
                recv.cancel()
                await websocket.send_json({"type": "ping"})

            # Heartbeat after every loop iteration, in a scoped session that
            # commits + closes before we go back to waiting. No pool holding.
            async with SessionLocal() as db:
                await owner_heartbeat(db)
                await db.commit()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await mgr.unsubscribe(websocket)