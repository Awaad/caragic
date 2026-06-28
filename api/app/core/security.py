from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from ..config import get_settings

_hasher = PasswordHasher()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _hasher.verify(password_hash, password)
        return True
    except (VerifyMismatchError, InvalidHashError):
        return False


def verify_totp(code: str, secret: str) -> bool:
    # valid_window=1 → accept previous/next 30s window for clock skew
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def create_admin_token(subject: str) -> tuple[str, datetime]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.owner_jwt_ttl_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "scope": "admin",
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.owner_jwt_algorithm)
    return token, expires_at


def decode_admin_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    # Raises jwt.InvalidTokenError (and subclasses) on failure
    return jwt.decode(token, settings.secret_key, algorithms=[settings.owner_jwt_algorithm])