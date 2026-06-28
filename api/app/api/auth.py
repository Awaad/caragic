from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..config import get_settings
from ..core.owner_auth import get_current_owner
from ..core.security import create_admin_token, verify_password, verify_totp
from ..schemas.auth import AdminLoginRequest, AdminLoginResponse, AdminMeResponse

router = APIRouter(prefix="/admin", tags=["admin"])


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.admin_cookie_name,
        value=token,
        max_age=settings.owner_jwt_ttl_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/api",
    )


@router.post("/login", response_model=AdminLoginResponse)
def login(payload: AdminLoginRequest, response: Response) -> AdminLoginResponse:
    settings = get_settings()

    # Run all three checks before returning, to avoid leaking which one failed via timing.
    username_ok = payload.username == settings.admin_username
    password_ok = verify_password(payload.password, settings.admin_password_hash)
    totp_ok = verify_totp(payload.totp_code, settings.admin_totp_secret)

    if not (username_ok and password_ok and totp_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )

    token, expires_at = create_admin_token(subject=f"owner:{settings.admin_username}")
    _set_session_cookie(response, token)
    return AdminLoginResponse(ok=True, expires_at=expires_at.isoformat())


@router.post("/logout")
def logout(response: Response) -> dict:
    settings = get_settings()
    response.delete_cookie(
        key=settings.admin_cookie_name,
        path="/api",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    return {"ok": True}


@router.get("/me", response_model=AdminMeResponse)
def me(response: Response, owner: dict = Depends(get_current_owner)) -> AdminMeResponse:
    settings = get_settings()
    # Sliding refresh: every authenticated hit reissues the cookie.
    token, expires_at = create_admin_token(subject=owner["sub"])
    _set_session_cookie(response, token)
    return AdminMeResponse(
        username=settings.admin_username,
        scope=owner.get("scope", "admin"),
        expires_at=expires_at.isoformat(),
    )