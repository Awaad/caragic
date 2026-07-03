"""Resolve the real client IP from a request, respecting configured trusted
proxies.

Header precedence when a proxy is trusted:
  1. CF-Connecting-IP  — Cloudflare's canonical header
  2. X-Real-IP         — nginx/traefik convention
  3. X-Forwarded-For   — de facto standard; leftmost = original client
  4. request.client.host — connection IP (fallback)

When no proxy is trusted, we go straight to request.client.host regardless
of what headers are present. This prevents header spoofing in dev / direct
exposure — an attacker who reaches the API directly can't forge their IP
by sending an X-Forwarded-For.
"""
from __future__ import annotations

from fastapi import Request

from ..config import get_settings


def get_client_ip(request: Request) -> str:
    """Best-effort client IP. Never raises; falls back to '0.0.0.0' if we
    somehow can't determine anything (extremely rare)."""
    settings = get_settings()
    trusted = settings.trusted_proxy_ip_list

    # No trusted proxies configured → connection IP is the truth
    if not trusted:
        return request.client.host if request.client else "0.0.0.0"

    # Trusted proxy present → honor forwarded headers
    connection_ip = request.client.host if request.client else "0.0.0.0"

    # Wildcard: trust anything
    if "*" not in trusted and connection_ip not in trusted:
        # Connection is NOT from a trusted proxy — ignore headers, use direct
        return connection_ip

    # Cloudflare's dedicated header — canonical when behind CF
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    xff = request.headers.get("x-forwarded-for")
    if xff:
        # Leftmost is the original client; subsequent are proxies in the chain
        first = xff.split(",")[0].strip()
        if first:
            return first

    return connection_ip