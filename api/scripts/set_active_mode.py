"""Set or read the active mode for /tap.

Usage:
    docker compose exec api uv run python scripts/set_active_mode.py
    docker compose exec api uv run python scripts/set_active_mode.py dating
"""
from __future__ import annotations

import asyncio
import sys

from app.core.token_service import VALID_MODES, get_active_mode, set_active_mode
from app.db import SessionLocal


async def main() -> int:
    if len(sys.argv) == 1:
        async with SessionLocal() as db:
            current = await get_active_mode(db)
        print(f"active mode: {current}")
        return 0

    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} [mode]", file=sys.stderr)
        return 2

    mode = sys.argv[1]
    if mode not in VALID_MODES:
        print(
            f"invalid mode: {mode!r}. valid: {', '.join(sorted(VALID_MODES))}",
            file=sys.stderr,
        )
        return 2

    async with SessionLocal() as db:
        await set_active_mode(db, mode)
        await db.commit()
    print(f"active mode set to: {mode}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))