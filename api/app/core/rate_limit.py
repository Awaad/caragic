"""Redis-backed fixed-window rate limiter.

Fixed window (INCR + EXPIRE) is chosen for simplicity, sliding window with
sorted sets is more accurate but adds Redis ops per check and, at the limits
we're setting, the boundary-burst edge case is a non-issue.

Every limit is (max_count, window_seconds) sourced from Settings, so tuning
is env-only. When a limit is exceeded we raise 429 with a Retry-After header
so honest clients (and civilized bots) can back off cleanly.

Single Redis connection reused across the app via lifespan management —
see main.py's lifespan.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis

from ..config import get_settings
from .client_ip import get_client_ip


# Redis client singleton (populated in main.py lifespan)

_redis: Redis | None = None


def set_redis_client(client: Redis) -> None:
    global _redis
    _redis = client


def get_redis_client() -> Redis:
    if _redis is None:
        raise RuntimeError("redis client not initialized")
    return _redis


# Core check

@dataclass(frozen=True)
class RateLimit:
    """A single rate-limit rule. `name` disambiguates keys so two rules against
    the same identifier don't collide (e.g. per-IP submission limit vs per-IP
    admin limit)."""
    name: str
    max_count: int
    window_seconds: int


async def _check(key: str, rule: RateLimit) -> None:
    """Atomically increment the counter and enforce. First increment sets the
    TTL; subsequent increments in the same window inherit it. If we're already
    over, raise 429 with Retry-After hinting when they can try again."""
    r = get_redis_client()

    # Pipeline: INCR + TTL in one round trip. If TTL is -1 (key exists but no
    # expiry shouldn't happen but be defensive) or -2 (key gone between
    # INCR and TTL race, also handled), we set the window fresh.
    async with r.pipeline(transaction=False) as pipe:
        pipe.incr(key)
        pipe.ttl(key)
        count, ttl = await pipe.execute()

    if ttl < 0:
        # First hit in this window — set expiry
        await r.expire(key, rule.window_seconds)
        ttl = rule.window_seconds

    if count > rule.max_count:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"rate limit exceeded ({rule.name})",
            headers={"Retry-After": str(max(1, ttl))},
        )


# Public API: FastAPI dependencies

def _make_key(rule_name: str, identifier: str) -> str:
    return f"rl:{rule_name}:{identifier}"


async def limit_by_ip(request: Request, rule: RateLimit) -> None:
    ip = get_client_ip(request)
    await _check(_make_key(rule.name, ip), rule)


async def limit_by_session(session_id: str, rule: RateLimit) -> None:
    await _check(_make_key(rule.name, session_id), rule)


# Concrete rules built from Settings

def _rules() -> dict[str, RateLimit]:
    s = get_settings()
    return {
        "tap_ip": RateLimit("tap_ip", s.ratelimit_tap_ip_max, s.ratelimit_tap_ip_window),
        "link_ip": RateLimit("link_ip", s.ratelimit_link_ip_max, s.ratelimit_link_ip_window),
        "submission_session": RateLimit(
            "submission_session",
            s.ratelimit_submission_session_max,
            s.ratelimit_submission_session_window,
        ),
        "submission_ip": RateLimit(
            "submission_ip",
            s.ratelimit_submission_ip_max,
            s.ratelimit_submission_ip_window,
        ),
        "erase_session": RateLimit(
            "erase_session",
            s.ratelimit_erase_session_max,
            s.ratelimit_erase_session_window,
        ),
        "admin_login_ip": RateLimit(
            "admin_login_ip",
            s.ratelimit_admin_login_ip_max,
            s.ratelimit_admin_login_ip_window,
        ),
        "admin_general_ip": RateLimit(
            "admin_general_ip",
            s.ratelimit_admin_general_ip_max,
            s.ratelimit_admin_general_ip_window,
        ),
    }


# Named enforcement helpers

async def enforce_tap_ip(request: Request) -> None:
    await limit_by_ip(request, _rules()["tap_ip"])


async def enforce_link_ip(request: Request) -> None:
    await limit_by_ip(request, _rules()["link_ip"])


async def enforce_submission_ip(request: Request) -> None:
    await limit_by_ip(request, _rules()["submission_ip"])


async def enforce_submission_session(session_id: str) -> None:
    await limit_by_session(session_id, _rules()["submission_session"])


async def enforce_erase_session(session_id: str) -> None:
    await limit_by_session(session_id, _rules()["erase_session"])


async def enforce_admin_login_ip(request: Request) -> None:
    await limit_by_ip(request, _rules()["admin_login_ip"])


async def enforce_admin_general_ip(request: Request) -> None:
    await limit_by_ip(request, _rules()["admin_general_ip"])