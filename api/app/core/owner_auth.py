from __future__ import annotations

import jwt
from fastapi import Cookie, HTTPException, status

from ..config import get_settings
from .security import decode_admin_token


def get_current_owner(admin_session: str | None = Cookie(default=None)) -> dict:
    """FastAPI dependency. Validates the admin JWT cookie and returns the payload.

    Note: the parameter name `admin_session` matches the default cookie name.
    If you change `admin_cookie_name` in settings, also use `Cookie(alias=...)` here.
    """
    settings = get_settings()
    if admin_session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    try:
        payload = decode_admin_token(admin_session)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid session")
    if payload.get("scope") != "admin":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid scope")
    if payload.get("sub") != f"owner:{settings.admin_username}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unknown subject")
    return payload