"""Prelude Verify wrapper.

Two operations:
  - start(phone_e164) → verification_id
  - check(verification_id, code) → OtpCheckResult

Dev mode (OTP_DEV_MODE=true) short-circuits both:
  - start returns a fake id and logs the "code" (always "000000")
  - check accepts "000000" only, rejects everything else

Prelude API docs: https://docs.prelude.dev/api-reference
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from enum import Enum

import httpx

from ..config import get_settings


logger = logging.getLogger("card.otp")


class OtpCheckStatus(str, Enum):
    """Prelude returns one of these on /verification/check. We collapse
    provider strings into our own enum so downstream code isn't coupled."""

    SUCCESS = "success"
    RETRY = "retry"          # wrong code, try again
    EXPIRED = "expired"      # verification_id too old
    BLOCKED = "blocked"      # fraud signal, refuse further attempts
    UNKNOWN = "unknown"


@dataclass
class OtpStartResult:
    verification_id: str


@dataclass
class OtpCheckResult:
    status: OtpCheckStatus
    raw: dict | None = None  # for logging on unexpected shapes


class OtpProviderError(Exception):
    """Provider is down or misbehaving. Distinct from user-input errors
    (wrong code, expired) so we can surface a proper 503 upstream."""


_DEV_CODE = "000000"
_DEV_ID_PREFIX = "dev_"


async def start_verification(phone_e164: str) -> OtpStartResult:
    settings = get_settings()

    if settings.otp_dev_mode:
        vid = f"{_DEV_ID_PREFIX}{uuid.uuid4().hex[:16]}"
        logger.warning(
            "OTP_DEV_MODE — pretending to send code %s to %s (id=%s)",
            _DEV_CODE, phone_e164, vid,
        )
        return OtpStartResult(verification_id=vid)

    if not settings.prelude_api_token:
        raise OtpProviderError("prelude not configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.prelude_api_base}/v2/verification",
                headers={
                    "Authorization": f"Bearer {settings.prelude_api_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "target": {"type": "phone_number", "value": phone_e164},
                },
            )
    except httpx.HTTPError as exc:
        logger.exception("prelude start failed (network)")
        raise OtpProviderError(str(exc)) from exc

    if resp.status_code >= 500:
        logger.error("prelude start 5xx: %s %s", resp.status_code, resp.text)
        raise OtpProviderError(f"provider {resp.status_code}")

    if resp.status_code >= 400:
        # 4xx here usually means invalid phone shape — bubble up as a
        # regular provider error so the endpoint returns 422/400 cleanly.
        logger.warning("prelude start 4xx: %s %s", resp.status_code, resp.text)
        raise OtpProviderError(f"invalid request: {resp.text}")

    data = resp.json()
    vid = data.get("id")
    if not vid:
        logger.error("prelude start: missing id in response: %s", data)
        raise OtpProviderError("malformed provider response")

    return OtpStartResult(verification_id=vid)


async def check_verification(
    verification_id: str, code: str, phone_e164: str,
) -> OtpCheckResult:
    settings = get_settings()

    # Dev-mode branch — accept only 000000, and only for ids we minted
    if settings.otp_dev_mode:
        if not verification_id.startswith(_DEV_ID_PREFIX):
            return OtpCheckResult(status=OtpCheckStatus.EXPIRED)
        if code == _DEV_CODE:
            return OtpCheckResult(status=OtpCheckStatus.SUCCESS)
        return OtpCheckResult(status=OtpCheckStatus.RETRY)

    if not settings.prelude_api_token:
        raise OtpProviderError("prelude not configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.prelude_api_base}/v2/verification/check",
                headers={
                    "Authorization": f"Bearer {settings.prelude_api_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "target": {"type": "phone_number", "value": phone_e164},
                    "code": code,
                },
            )
    except httpx.HTTPError as exc:
        logger.exception("prelude check failed (network)")
        raise OtpProviderError(str(exc)) from exc

    if resp.status_code >= 500:
        logger.error("prelude check 5xx: %s %s", resp.status_code, resp.text)
        raise OtpProviderError(f"provider {resp.status_code}")

    data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}

    # Prelude returns { "status": "success" | "retry" | "expired" | "blocked" }
    # Anything else lands as UNKNOWN and we log to fix.
    status_str = data.get("status", "unknown")
    try:
        status = OtpCheckStatus(status_str)
    except ValueError:
        logger.error("prelude check: unknown status %r: %s", status_str, data)
        status = OtpCheckStatus.UNKNOWN

    return OtpCheckResult(status=status, raw=data)