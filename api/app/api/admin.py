from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..core.owner_auth import get_current_owner
from ..core.token_service import mint_token, set_active_mode
from ..db import get_db
from ..schemas.admin import (
    ActiveModeResponse,
    CreateTokenRequest,
    CreateTokenResponse,
    SetActiveModeRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/tokens", response_model=CreateTokenResponse)
async def create_link_token(
    payload: CreateTokenRequest,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> CreateTokenResponse:
    """Owner-only. Mints a kind='link' token bound to the given mode and
    returns the full shareable URL. This is the ONLY time the raw token
    value is ever returned by the API — store the URL somewhere or you'll
    have to revoke and regenerate."""
    settings = get_settings()
    raw, row = await mint_token(db, kind="link", mode=payload.mode, label=payload.label)
    await db.commit()
    url = f"{settings.public_base_url.rstrip('/')}/c/{raw}"
    return CreateTokenResponse(
        id=str(row.id),
        token=raw,
        url=url,
        mode=row.mode,
        label=row.label,
        kind=row.kind,
    )


@router.post("/mode/active", response_model=ActiveModeResponse)
async def update_active_mode(
    payload: SetActiveModeRequest,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> ActiveModeResponse:
    """Owner-only. Sets the active mode for /tap. NFC card behavior
    follows this immediately — no card reprogramming needed."""
    mode = await set_active_mode(db, payload.mode)
    await db.commit()
    return ActiveModeResponse(mode=mode)


@router.get("/mode/active", response_model=ActiveModeResponse)
async def read_active_mode(
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> ActiveModeResponse:
    """Owner-only. Read current active mode (admin UI will use this on load)."""
    from ..core.token_service import get_active_mode
    mode = await get_active_mode(db)
    return ActiveModeResponse(mode=mode)