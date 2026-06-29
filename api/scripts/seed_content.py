"""Seed (or re-seed) content from seeds/content_v1.json.

Idempotent: existing rows are updated, missing rows are inserted,
rows present in DB but not in the seed file are left alone (we don't
delete on seed. that'd be too easy to footgun during dev).

Usage:
    docker compose exec api uv run python scripts/seed_content.py
    docker compose exec api uv run python scripts/seed_content.py path/to/other.json
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Mode, Reveal, Round


DEFAULT_SEED = Path(__file__).resolve().parent.parent / "seeds" / "content_v1.json"


async def main() -> int:
    seed_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SEED
    if not seed_path.exists():
        print(f"seed file not found: {seed_path}", file=sys.stderr)
        return 2

    with seed_path.open() as f:
        seed = json.load(f)

    async with SessionLocal() as db:
        for mode_seed in seed["modes"]:
            mode_name = mode_seed["name"]
            mode = (
                await db.execute(select(Mode).where(Mode.name == mode_name))
            ).scalar_one_or_none()
            if mode is None:
                mode = Mode(name=mode_name)
                db.add(mode)
                await db.flush()
                print(f"  created mode: {mode_name}")
            else:
                print(f"  updating mode: {mode_name}")

            # Reveal — one per mode, upsert by mode_id
            reveal_seed = mode_seed["reveal"]
            reveal = (
                await db.execute(select(Reveal).where(Reveal.mode_id == mode.id))
            ).scalar_one_or_none()
            if reveal is None:
                reveal = Reveal(
                    mode_id=mode.id,
                    name=reveal_seed["name"],
                    tagline=reveal_seed.get("tagline", ""),
                    links=reveal_seed.get("links", []),
                )
                db.add(reveal)
            else:
                reveal.name = reveal_seed["name"]
                reveal.tagline = reveal_seed.get("tagline", "")
                reveal.links = reveal_seed.get("links", [])

            # Rounds — upsert by (mode_id, slug), assign position by list order
            for position, round_seed in enumerate(mode_seed["rounds"]):
                slug = round_seed["slug"]
                existing = (
                    await db.execute(
                        select(Round).where(Round.mode_id == mode.id).where(Round.slug == slug)
                    )
                ).scalar_one_or_none()
                if existing is None:
                    db.add(
                        Round(
                            mode_id=mode.id,
                            position=position,
                            round_type=round_seed["round_type"],
                            slug=slug,
                            data=round_seed["data"],
                        )
                    )
                else:
                    existing.position = position
                    existing.round_type = round_seed["round_type"]
                    existing.data = round_seed["data"]

        await db.commit()

    print("seed complete.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))