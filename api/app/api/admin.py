from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from ..config import get_settings
from ..core.owner_auth import get_current_owner
from ..core.token_service import mint_token, set_active_mode
from ..core.mode_service import (
    create_mode,
    list_modes,
    purge_mode,
    transition_mode_status,
)
from ..core.token_admin_service import (
    list_tokens,
    purge_token,
    transition_token_status,
)

from ..db import get_db
from ..schemas.admin import (
    ActiveModeResponse,
    CreateTokenRequest,
    CreateTokenResponse,
    SetActiveModeRequest,
    CreateModeRequest,
    ModeListResponse,
    ModeStatusRequest,
    ModeSummary,
    TokenListResponse,
    TokenStatusRequest,
    TokenSummary,
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



# modes

def _mode_to_summary(mode, round_count: int) -> ModeSummary:
    return ModeSummary(
        id=str(mode.id),
        name=mode.name,
        status=mode.status,
        round_count=round_count,
        created_at=mode.created_at,
        updated_at=mode.updated_at,
    )


@router.get("/modes", response_model=ModeListResponse)
async def get_modes(
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
    status_filter: Annotated[list[str] | None, Query(alias="status")] = None,
) -> ModeListResponse:
    """List modes. Default returns all statuses; pass ?status=active&status=inactive
    to filter. Archived modes appear only when explicitly requested."""
    if status_filter is None:
        # Default: exclude archived (cleaner admin view)
        status_filter = ["active", "inactive"]
    rows = await list_modes(db, statuses=status_filter)
    return ModeListResponse(modes=[_mode_to_summary(m, c) for m, c in rows])


@router.post("/modes", response_model=ModeSummary, status_code=201)
async def create_new_mode(
    payload: CreateModeRequest,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> ModeSummary:
    mode = await create_mode(db, payload)
    await db.commit()
    # Refresh round count for the response
    rows = await list_modes(db, statuses=[mode.status])
    matching = [(m, c) for m, c in rows if m.name == mode.name]
    return _mode_to_summary(*matching[0])


@router.post("/modes/{name}/status", response_model=ModeSummary)
async def change_mode_status(
    name: str,
    payload: ModeStatusRequest,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> ModeSummary:
    mode = await transition_mode_status(db, name, payload.status)
    await db.commit()
    rows = await list_modes(db, statuses=[mode.status])
    matching = [(m, c) for m, c in rows if m.name == mode.name]
    return _mode_to_summary(*matching[0])


@router.delete("/modes/{name}", status_code=204)
async def delete_mode(
    name: str,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
    confirm: Annotated[bool, Query()] = False,
) -> None:
    """Hard purge. Requires mode.status='archived' and no tokens referencing it.
    Pass ?confirm=true to actually delete."""
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="purge requires ?confirm=true",
        )
    await purge_mode(db, name)
    await db.commit()


# tokens lifecycle

def _token_to_summary(t) -> TokenSummary:
    return TokenSummary(
        id=str(t.id),
        kind=t.kind,
        mode=t.mode,
        label=t.label,
        status=t.status,
        tap_count=t.tap_count,
        created_at=t.created_at,
        last_used_at=t.last_used_at,
        revoked_at=t.revoked_at,
        revoked_reason=t.revoked_reason,
    )


@router.get("/tokens", response_model=TokenListResponse)
async def get_tokens(
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
    status_filter: Annotated[list[str] | None, Query(alias="status")] = None,
    mode: Annotated[str | None, Query()] = None,
    kind: Annotated[str | None, Query()] = None,
) -> TokenListResponse:
    tokens = await list_tokens(db, statuses=status_filter, mode=mode, kind=kind)
    return TokenListResponse(tokens=[_token_to_summary(t) for t in tokens])


@router.post("/tokens/{token_id}/status", response_model=TokenSummary)
async def change_token_status(
    token_id: uuid.UUID,  
    payload: TokenStatusRequest,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> TokenSummary:
    token = await transition_token_status(db, token_id, payload.status, payload.reason)
    await db.commit()
    return _token_to_summary(token)


@router.delete("/tokens/{token_id}", status_code=204)
async def delete_token(
    token_id: uuid.UUID,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
    confirm: Annotated[bool, Query()] = False,
) -> None:
    """Hard purge. Cascade-deletes all sessions bound to the token. Token must
    be 'revoked' first. Pass ?confirm=true to actually delete."""
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="purge requires ?confirm=true",
        )
    await purge_token(db, token_id)
    await db.commit()