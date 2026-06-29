"""Mint a kind='link' token and print the full shareable URL.

Usage:
    docker compose exec api uv run python scripts/create_token.py dating
    docker compose exec api uv run python scripts/create_token.py mix "for the dinner thing"
"""
from __future__ import annotations

import asyncio
import sys

from app.config import get_settings
from app.core.token_service import VALID_MODES, mint_token
from app.db import SessionLocal


async def main() -> int:
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print(f"usage: {sys.argv[0]} <mode> [label]", file=sys.stderr)
        return 2

    mode = sys.argv[1]
    if mode not in VALID_MODES:
        print(
            f"invalid mode: {mode!r}. valid: {', '.join(sorted(VALID_MODES))}",
            file=sys.stderr,
        )
        return 2

    label = sys.argv[2] if len(sys.argv) == 3 else None

    settings = get_settings()
    async with SessionLocal() as db:
        raw, row = await mint_token(db, kind="link", mode=mode, label=label)
        await db.commit()

    url = f"{settings.public_base_url.rstrip('/')}/c/{raw}"
    print()
    print(f"  id:    {row.id}")
    print(f"  mode:  {row.mode}")
    print(f"  label: {row.label or '(none)'}")
    print(f"  url:   {url}")
    print()
    print("  copy the url now — the raw token isn't recoverable from the DB.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))