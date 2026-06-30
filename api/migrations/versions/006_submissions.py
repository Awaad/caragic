"""submissions table

Revision ID: 006
Revises: 005
Create Date: 2026-06-30

Adds the submissions table, every flow completion (submitted or declined)
gets a row. Name + phone are encrypted at rest via AES-GCM (column type bytea,
nonce-prefixed). A separate phone_hash column holds an HMAC-SHA256 fingerprint
of the canonical E.164 so we can detect duplicate phone numbers across sessions
without ever having to decrypt anything.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "submissions",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "visitor_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("visitors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("visitor_session_tokens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "token_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tokens.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        # Denormalized: lets admin filter by mode without joining through token.
        # Source of truth is still tokens.mode; this is a copy at submission time.
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("outcome", sa.String(length=16), nullable=False),
        sa.Column("attempt_number", sa.Integer, nullable=False, server_default="1"),
        # NULL when outcome='declined' — declines don't carry identity payload
        sa.Column("name_encrypted", sa.LargeBinary, nullable=True),
        sa.Column("phone_encrypted", sa.LargeBinary, nullable=True),
        # HMAC-SHA256 hex of canonical E.164. NULL on declines. Indexed (partial)
        # so we can answer "has this phone submitted before?" cheaply.
        sa.Column("phone_hash", sa.String(length=64), nullable=True),
        # [{round_id: slug, option_id: string}, ...]
        # Submissions carry the full answer payload; declines carry whatever
        # answers the visitor managed to give before bailing (possibly empty).
        sa.Column(
            "answers",
            sa.dialects.postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "outcome IN ('submitted', 'declined')",
            name="submissions_outcome_check",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'read', 'archived')",
            name="submissions_status_check",
        ),
        # Identity payload required for submitted, forbidden for declined
        sa.CheckConstraint(
            "(outcome = 'submitted' AND name_encrypted IS NOT NULL "
            " AND phone_encrypted IS NOT NULL AND phone_hash IS NOT NULL) "
            "OR (outcome = 'declined' AND name_encrypted IS NULL "
            " AND phone_encrypted IS NULL AND phone_hash IS NULL)",
            name="submissions_outcome_payload_check",
        ),
        sa.CheckConstraint(
            "attempt_number >= 1",
            name="submissions_attempt_number_check",
        ),
    )

    op.create_index(
        "ix_submissions_session_id", "submissions", ["session_id"]
    )
    op.create_index(
        "ix_submissions_mode_created_at",
        "submissions",
        ["mode", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_submissions_outcome_status", "submissions", ["outcome", "status"]
    )
    # Partial index: only submitted rows have a phone_hash, no point indexing NULLs
    op.create_index(
        "ix_submissions_phone_hash",
        "submissions",
        ["phone_hash"],
        postgresql_where=sa.text("phone_hash IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_submissions_phone_hash", table_name="submissions")
    op.drop_index("ix_submissions_outcome_status", table_name="submissions")
    op.drop_index("ix_submissions_mode_created_at", table_name="submissions")
    op.drop_index("ix_submissions_session_id", table_name="submissions")
    op.drop_table("submissions")