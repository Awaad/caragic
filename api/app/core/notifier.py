"""Notification dispatcher.

Two event types:
  - submission_created (submitted or declined)
  - visitor_error (uncaught 5xx in visitor endpoints)

Design:
  - Fire-and-forget via asyncio.create_task. Visitor's HTTP response never
    waits on email delivery.
  - Own database session (background task, no request-scoped session).
  - Self-throttle for errors via Redis: max N per hour, drop rest with
    a "N suppressed" note in the next successful send.
  - All failures logged, none propagated. If the notifier itself blows up,
    we log and swallow.
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from datetime import datetime, timezone
from email.mime.text import MIMEText

from redis.asyncio import Redis

from ..config import get_settings
from ..db import SessionLocal
from ..schemas.notifications import NotificationsConfig
from .notifications_config import (
    load_config,
    record_send_error,
    record_send_success,
)
from .rate_limit import get_redis_client


logger = logging.getLogger("card.notifier")


# Error notifier self-throttle: max 10 error emails per hour, then suppress.
# Reuses the Redis client set up for rate limiting.
_ERROR_THROTTLE_KEY = "notifier:error_throttle"
_ERROR_THROTTLE_MAX = 10
_ERROR_THROTTLE_WINDOW = 3600  # 1h
_ERROR_SUPPRESSED_KEY = "notifier:error_suppressed_count"


# Public API

def notify_submission_created(
    *,
    submission_id: str,
    mode: str,
    outcome: str,
    attempt_number: int,
    has_identity: bool,
) -> None:
    """Fire-and-forget. Safe to call from request handlers — never raises,
    never awaits. Errors log-and-continue inside the task."""
    asyncio.create_task(
        _dispatch_submission(
            submission_id=submission_id,
            mode=mode,
            outcome=outcome,
            attempt_number=attempt_number,
            has_identity=has_identity,
        )
    )


def notify_visitor_error(
    *,
    request_id: str,
    path: str,
    method: str,
    error_type: str,
    error_message: str,
) -> None:
    """Same pattern. Called from errors.py's fallback handlers."""
    asyncio.create_task(
        _dispatch_error(
            request_id=request_id,
            path=path,
            method=method,
            error_type=error_type,
            error_message=error_message,
        )
    )


# Task bodies

async def _dispatch_submission(
    *,
    submission_id: str,
    mode: str,
    outcome: str,
    attempt_number: int,
    has_identity: bool,
) -> None:
    try:
        async with SessionLocal() as db:
            config = await load_config(db)
            if not config.enabled:
                return

            settings = get_settings()
            link = f"{settings.admin_public_base_url.rstrip('/')}/submissions/{submission_id}"

            env_tag = (
                f"[{settings.environment}] "
                if settings.environment != "prod"
                else ""
            )
            subject = f"{env_tag}[Caragic] New {outcome} submission — {mode}"

            body_lines = [
                f"A new submission just landed.",
                "",
                f"  mode:           {mode}",
                f"  outcome:        {outcome}",
                f"  attempt number: {attempt_number}",
                f"  has identity:   {'yes' if has_identity else 'no'}",
                "",
                f"View in admin:",
                f"  {link}",
                "",
                "— Caragic",
            ]

            # Prepend suppressed-error note if any accumulated
            body = await _prepend_suppression_note(body_lines)

            await _send(db, config, subject=subject, body=body)
    except Exception:
        logger.exception("notifier: submission dispatch failed")


async def _dispatch_error(
    *,
    request_id: str,
    path: str,
    method: str,
    error_type: str,
    error_message: str,
) -> None:
    try:
        # Throttle check — Redis INCR + EXPIRE
        try:
            r = get_redis_client()
            async with r.pipeline(transaction=False) as pipe:
                pipe.incr(_ERROR_THROTTLE_KEY)
                pipe.ttl(_ERROR_THROTTLE_KEY)
                count, ttl = await pipe.execute()
            if ttl < 0:
                await r.expire(_ERROR_THROTTLE_KEY, _ERROR_THROTTLE_WINDOW)
            if count > _ERROR_THROTTLE_MAX:
                await r.incr(_ERROR_SUPPRESSED_KEY)
                return
        except Exception:
            # Redis down? Fall through and try to send anyway — the whole
            # point of error notifications is that things are already broken
            logger.warning("notifier: throttle check failed, sending anyway")

        async with SessionLocal() as db:
            config = await load_config(db)
            if not config.enabled:
                return

            settings = get_settings()
            env_tag = (
                f"[{settings.environment}] "
                if settings.environment != "prod"
                else ""
            )
            subject = f"{env_tag}[Caragic] Visitor error — {path}"

            body_lines = [
                "An uncaught 5xx occurred in a visitor endpoint.",
                "",
                f"  request_id:  {request_id}",
                f"  method:      {method}",
                f"  path:        {path}",
                f"  error type:  {error_type}",
                f"  error msg:   {error_message[:500]}",
                "",
                "Check server logs for full traceback.",
                "",
                "— Caragic",
            ]

            body = await _prepend_suppression_note(body_lines)

            await _send(db, config, subject=subject, body=body)
    except Exception:
        logger.exception("notifier: error dispatch failed")


async def _prepend_suppression_note(body_lines: list[str]) -> str:
    """If prior errors were suppressed, mention it at the top of the next
    successful email and reset the counter."""
    try:
        r = get_redis_client()
        suppressed = await r.get(_ERROR_SUPPRESSED_KEY)
        if suppressed and int(suppressed) > 0:
            note = (
                f"[note: {suppressed} additional error notification(s) "
                f"suppressed by throttle in the past hour]\n"
            )
            await r.delete(_ERROR_SUPPRESSED_KEY)
            return note + "\n".join(body_lines)
    except Exception:
        pass
    return "\n".join(body_lines)


# SMTP send

async def _send(
    db,
    config: NotificationsConfig,
    *,
    subject: str,
    body: str,
) -> None:
    """Actually send. Runs SMTP in a thread so we don't block the event loop.
    Records success/error on the config row."""
    if not config.smtp_host or not config.notification_to:
        return  # nothing configured, silently no-op

    try:
        await asyncio.to_thread(
            _smtp_send_sync,
            config=config,
            subject=subject,
            body=body,
        )
        await record_send_success(db)
        await db.commit()
    except Exception as exc:
        logger.warning("notifier: send failed: %s", exc)
        try:
            await record_send_error(db, str(exc))
            await db.commit()
        except Exception:
            logger.exception("notifier: failed to record error state")


def _smtp_send_sync(
    *,
    config: NotificationsConfig,
    subject: str,
    body: str,
) -> None:
    """Blocking SMTP. Called via asyncio.to_thread."""
    msg = MIMEText(body, _charset="utf-8")
    msg["Subject"] = subject
    msg["From"] = config.notification_from
    msg["To"] = ", ".join(config.notification_to)

    if config.smtp_use_tls:
        # STARTTLS flow (port 587)
        with smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=10) as s:
            s.starttls()
            if config.smtp_username and config.smtp_password:
                s.login(config.smtp_username, config.smtp_password)
            s.send_message(msg)
    else:
        # Implicit TLS on port 465, or plain (rare, dev-local only)
        if config.smtp_port == 465:
            with smtplib.SMTP_SSL(config.smtp_host, config.smtp_port, timeout=10) as s:
                if config.smtp_username and config.smtp_password:
                    s.login(config.smtp_username, config.smtp_password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=10) as s:
                if config.smtp_username and config.smtp_password:
                    s.login(config.smtp_username, config.smtp_password)
                s.send_message(msg)


# Test send (called synchronously from admin endpoint)

async def send_test_email(config: NotificationsConfig) -> None:
    """Send a test email using the provided (unsaved) config. Raises on
    failure so the admin endpoint can return an error to the UI."""
    settings = get_settings()
    subject = f"[{settings.environment}] [Caragic] Test notification"
    body = (
        "This is a test notification from Caragic.\n\n"
        "If you're reading this, SMTP is configured correctly.\n\n"
        "— Caragic"
    )
    await asyncio.to_thread(
        _smtp_send_sync, config=config, subject=subject, body=body
    )