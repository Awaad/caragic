"""In-process WebSocket connection registry + Redis pub/sub dispatcher.

One instance lives in app state (see main.py lifespan). It:
  - Tracks (conversation_id → set of websockets) for local delivery
  - Also tracks (channel → set of websockets) for admin-side aggregate streams
  - Runs a single Redis pattern-subscribe on 'chat:*' as a background task
  - Dispatches incoming pub/sub payloads to matching sockets

Cross-process delivery: publish to 'chat:conversation:<id>' from anywhere
(any api replica); every subscribed WS receives it.

Why this shape:
  - One Redis subscription total, not one per WS (better resource ratio)
  - App-level registry is the natural home for future presence, force-
    disconnect, metrics
  - Testable: replace the manager with a fake, no Redis needed
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis


logger = logging.getLogger("card.chat.connections")


CONVERSATION_CHANNEL_PATTERN = "chat:conversation:*"
ADMIN_CHANNEL = "chat:admin"


def conversation_channel(conversation_id) -> str:
    return f"chat:conversation:{conversation_id}"


class ChatConnectionManager:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis
        # conversation_id (str) → set[WebSocket]
        self._conversation_subs: dict[str, set[WebSocket]] = defaultdict(set)
        # WebSocket → conversation_id, for cleanup
        self._ws_to_conversation: dict[WebSocket, str] = {}
        # admin listeners (get every conversation channel + admin channel)
        self._admin_subs: set[WebSocket] = set()

        self._pubsub_task: asyncio.Task | None = None
        self._stopped = asyncio.Event()

    async def start(self) -> None:
        """Called from app lifespan on startup."""
        self._pubsub_task = asyncio.create_task(self._pubsub_loop())

    async def stop(self) -> None:
        """Called from app lifespan on shutdown."""
        self._stopped.set()
        if self._pubsub_task is not None:
            self._pubsub_task.cancel()
            try:
                await self._pubsub_task
            except asyncio.CancelledError:
                pass

    async def subscribe_visitor(
        self, websocket: WebSocket, conversation_id
    ) -> None:
        key = str(conversation_id)
        self._conversation_subs[key].add(websocket)
        self._ws_to_conversation[websocket] = key

    async def subscribe_admin(self, websocket: WebSocket) -> None:
        self._admin_subs.add(websocket)

    async def unsubscribe(self, websocket: WebSocket) -> None:
        # Remove from conversation subscribers
        key = self._ws_to_conversation.pop(websocket, None)
        if key is not None:
            self._conversation_subs[key].discard(websocket)
            if not self._conversation_subs[key]:
                del self._conversation_subs[key]
        # Remove from admin subscribers
        self._admin_subs.discard(websocket)

    async def publish_message(self, conversation_id, payload: dict[str, Any]) -> None:
        """Send a message payload to Redis. All subscribed WS across all
        api replicas will receive it via the pub/sub loop."""
        channel = conversation_channel(conversation_id)
        message = json.dumps(payload, default=str)
        try:
            await self._redis.publish(channel, message)
            # Admin stream gets everything too, plus the conversation_id
            admin_payload = {"channel": channel, **payload}
            await self._redis.publish(ADMIN_CHANNEL, json.dumps(admin_payload, default=str))
        except Exception:
            logger.exception("failed to publish to redis")

    async def _pubsub_loop(self) -> None:
        """Single Redis pattern-subscription. Dispatches to in-memory subs."""
        while not self._stopped.is_set():
            try:
                async with self._redis.pubsub() as pubsub:
                    await pubsub.psubscribe(CONVERSATION_CHANNEL_PATTERN)
                    await pubsub.subscribe(ADMIN_CHANNEL)
                    async for msg in pubsub.listen():
                        if self._stopped.is_set():
                            break
                        if msg.get("type") not in ("pmessage", "message"):
                            continue
                        await self._dispatch(msg)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("pubsub loop crashed; restarting in 2s")
                await asyncio.sleep(2)

    async def _dispatch(self, msg: dict[str, Any]) -> None:
        channel = msg.get("channel")
        raw = msg.get("data")
        if not channel or not raw:
            return
        # channel comes as bytes when decode_responses=False; be defensive
        if isinstance(channel, bytes):
            channel = channel.decode()
        if isinstance(raw, bytes):
            raw = raw.decode()

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("pubsub payload not json: %r", raw[:200])
            return

        if channel == ADMIN_CHANNEL:
            targets = list(self._admin_subs)
        else:
            # channel: chat:conversation:<uuid>
            key = channel.rsplit(":", 1)[-1]
            targets = list(self._conversation_subs.get(key, set()))

        # Fire sends in parallel; drop failed connections
        results = await asyncio.gather(
            *(self._safe_send(ws, payload) for ws in targets),
            return_exceptions=True,
        )
        for ws, result in zip(targets, results):
            if isinstance(result, Exception):
                await self.unsubscribe(ws)

    async def _safe_send(self, ws: WebSocket, payload: dict[str, Any]) -> None:
        await ws.send_json(payload)


_manager: ChatConnectionManager | None = None


def set_connection_manager(m: ChatConnectionManager) -> None:
    global _manager
    _manager = m


def get_connection_manager() -> ChatConnectionManager:
    if _manager is None:
        raise RuntimeError("chat connection manager not initialized")
    return _manager