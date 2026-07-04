"""Owner status: available | away | busy | offline.

Storage: settings table, key='owner_status', value={status, updated_at, last_admin_heartbeat_at}.
Auto-degrade: background task flips available→away if last_admin_heartbeat_at
older than 15 min. Reconnect doesn't auto-flip back — explicit only.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal
from ..models import Setting


logger = logging.getLogger("card.owner_status")

Status = Literal["available", "away", "busy", "offline"]
SETTINGS_KEY = "owner_status"
AUTO_DEGRADE_AFTER = timedelta(minutes=15)


async def load(db: AsyncSession) -> dict:
    row = (
        await db.execute(select(Setting).where(Setting.key == SETTINGS_KEY))
    ).scalar_one_or_none()
    if row is None:
        return {
            "status": "offline",
            "updated_at": None,
            "last_admin_heartbeat_at": None,
        }
    return dict(row.value)


async def save(db: AsyncSession, payload: dict) -> None:
    row = (
        await db.execute(select(Setting).where(Setting.key == SETTINGS_KEY))
    ).scalar_one_or_none()
    if row is None:
        db.add(Setting(key=SETTINGS_KEY, value=payload))
    else:
        row.value = payload


async def set_status(db: AsyncSession, new_status: Status) -> dict:
    current = await load(db)
    current["status"] = new_status
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    await save(db, current)
    return current


async def heartbeat(db: AsyncSession) -> None:
    current = await load(db)
    current["last_admin_heartbeat_at"] = datetime.now(timezone.utc).isoformat()
    await save(db, current)


async def is_admin_ws_active_recent(db: AsyncSession, within: timedelta) -> bool:
    """Used by notifier to decide whether to email — if admin was seen
    within `within` recently, they're probably watching; skip email."""
    current = await load(db)
    hb = current.get("last_admin_heartbeat_at")
    if not hb:
        return False
    return datetime.fromisoformat(hb) > datetime.now(timezone.utc) - within


async def _auto_degrade_loop(stop: asyncio.Event) -> None:
    """Once a minute: if status==available and no heartbeat in AUTO_DEGRADE_AFTER,
    flip to away."""
    while not stop.is_set():
        try:
            async with SessionLocal() as db:
                current = await load(db)
                if current.get("status") == "available":
                    hb = current.get("last_admin_heartbeat_at")
                    now = datetime.now(timezone.utc)
                    stale = (
                        hb is None
                        or datetime.fromisoformat(hb) < now - AUTO_DEGRADE_AFTER
                    )
                    if stale:
                        current["status"] = "away"
                        current["updated_at"] = now.isoformat()
                        await save(db, current)
                        await db.commit()
                        # Publish so any connected visitor WS gets the update
                        from .chat_connections import get_connection_manager
                        try:
                            mgr = get_connection_manager()
                            await mgr.publish_status(current)
                        except Exception:
                            pass
        except Exception:
            logger.exception("auto_degrade_loop iteration failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=60)
        except asyncio.TimeoutError:
            pass


_task: asyncio.Task | None = None
_stop = asyncio.Event()


async def start_auto_degrade() -> None:
    global _task
    _stop.clear()
    _task = asyncio.create_task(_auto_degrade_loop(_stop))


async def stop_auto_degrade() -> None:
    _stop.set()
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass