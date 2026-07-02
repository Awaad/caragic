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

from ..core.submission_admin_service import (
    decrypt_submission_pii,
    get_submission,
    list_submissions,
    transition_submission_status,
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
    AdminSubmissionDetail,
    AdminSubmissionListResponse,
    AdminSubmissionSummary,
    SubmissionStatusRequest,
    WhoAmIResponse,
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
    
    
@router.get("/whoami", response_model=WhoAmIResponse)
async def whoami(owner: dict = Depends(get_current_owner)) -> WhoAmIResponse:
    """Cheap auth probe. 200 with username if the admin cookie is valid,
    401 otherwise. Called by the admin SPA on mount to drive the auth guard."""
    return WhoAmIResponse(username=owner["sub"])


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
    
    
    
# submissions

def _submission_to_summary(row) -> AdminSubmissionSummary:
    return AdminSubmissionSummary(
        id=row.id,
        mode=row.mode,
        outcome=row.outcome,
        status=row.status,
        attempt_number=row.attempt_number,
        has_identity=row.name_encrypted is not None,
        answer_count=len(row.answers or []),
        created_at=row.created_at,
    )


@router.get("/submissions", response_model=AdminSubmissionListResponse)
async def get_submissions(
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
    mode: Annotated[str | None, Query()] = None,
    outcome: Annotated[str | None, Query()] = None,
    status_filter: Annotated[list[str] | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before_id: Annotated[uuid.UUID | None, Query()] = None,
) -> AdminSubmissionListResponse:
    """List submissions. Default returns all statuses sorted by recency.
    Cursor-paginate by passing the last seen id as ?before_id=.

    PII is NOT included here — this is the inbox/metadata view.
    Fetch /submissions/{id} for the decrypted detail."""
    rows, next_cursor = await list_submissions(
        db,
        mode=mode,
        outcome=outcome,
        statuses=status_filter,
        limit=limit,
        before_id=before_id,
    )
    return AdminSubmissionListResponse(
        submissions=[_submission_to_summary(r) for r in rows],
        next_cursor=next_cursor,
    )


@router.get("/submissions/{submission_id}", response_model=AdminSubmissionDetail)
async def read_submission(
    submission_id: uuid.UUID,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> AdminSubmissionDetail:
    """Decrypt + return a single submission. This is the access-PII action.

    Does NOT auto-transition 'pending' → 'read'. The admin UI should do that
    explicitly via POST /submissions/{id}/status so the owner controls when
    something is marked read (e.g. inbox preview vs. actually opening)."""
    row = await get_submission(db, submission_id)
    name, phone = decrypt_submission_pii(row)
    return AdminSubmissionDetail(
        id=row.id,
        mode=row.mode,
        outcome=row.outcome,
        status=row.status,
        attempt_number=row.attempt_number,
        name=name,
        phone=phone,
        phone_hash=row.phone_hash,
        answers=list(row.answers or []),
        visitor_id=row.visitor_id,
        session_id=row.session_id,
        token_id=row.token_id,
        created_at=row.created_at,
    )


@router.post(
    "/submissions/{submission_id}/status",
    response_model=AdminSubmissionSummary,
)
async def change_submission_status(
    submission_id: uuid.UUID,
    payload: SubmissionStatusRequest,
    owner: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> AdminSubmissionSummary:
    """Transition a submission between pending/read/archived. No purge yet —
    submission purge will land alongside the broader privacy story
    (visitor right-to-be-forgotten) in a later session."""
    row = await transition_submission_status(db, submission_id, payload.status)
    await db.commit()
    return _submission_to_summary(row)