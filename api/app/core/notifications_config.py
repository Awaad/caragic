"""Load / save the notifications config from the settings table.

Lazy-init: first read creates an empty config if none exists, so we don't
need a data migration to seed it.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Setting
from ..schemas.notifications import NotificationsConfig


SETTINGS_KEY = "notifications_config"


async def load_config(db: AsyncSession) -> NotificationsConfig:
    row = (
        await db.execute(select(Setting).where(Setting.key == SETTINGS_KEY))
    ).scalar_one_or_none()

    if row is None:
        return NotificationsConfig()

    # value is a dict from JSONB  validate through pydantic to catch schema drift
    return NotificationsConfig.model_validate(row.value)


async def save_config(db: AsyncSession, config: NotificationsConfig) -> None:
    row = (
        await db.execute(select(Setting).where(Setting.key == SETTINGS_KEY))
    ).scalar_one_or_none()

    payload = config.model_dump(mode="json")

    if row is None:
        db.add(Setting(key=SETTINGS_KEY, value=payload))
    else:
        row.value = payload
    # Caller commits


async def record_send_success(db: AsyncSession) -> None:
    config = await load_config(db)
    config.last_sent_at = datetime.now(timezone.utc)
    config.last_error_at = None
    config.last_error_message = None
    await save_config(db, config)


async def record_send_error(db: AsyncSession, message: str) -> None:
    config = await load_config(db)
    config.last_error_at = datetime.now(timezone.utc)
    # Cap error message length so a huge stacktrace doesn't bloat the row
    config.last_error_message = message[:500]
    await save_config(db, config)