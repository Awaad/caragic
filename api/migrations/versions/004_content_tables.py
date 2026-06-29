"""modes, rounds, reveals

Revision ID: 004
Revises: 003
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "modes",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(32), nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "name IN ('dating', 'mix', 'friendship', 'professional')",
            name="ck_modes_name",
        ),
    )

    op.create_table(
        "rounds",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "mode_id",
            UUID(as_uuid=True),
            sa.ForeignKey("modes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("round_type", sa.String(16), nullable=False),
        # Stable external identifier so the frontend's existing round-id-keyed
        # state machine keeps working: 'dating-1', 'capture-mix', etc.
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("data", JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "round_type IN ('choice', 'capture')",
            name="ck_rounds_round_type",
        ),
        sa.UniqueConstraint("mode_id", "position", name="uq_rounds_mode_position"),
        sa.UniqueConstraint("mode_id", "slug", name="uq_rounds_mode_slug"),
    )
    op.create_index("ix_rounds_mode_id", "rounds", ["mode_id"])

    op.create_table(
        "reveals",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "mode_id",
            UUID(as_uuid=True),
            sa.ForeignKey("modes.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("tagline", sa.String(1024), nullable=False, server_default=sa.text("''")),
        sa.Column("links", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("reveals")
    op.drop_index("ix_rounds_mode_id", table_name="rounds")
    op.drop_table("rounds")
    op.drop_table("modes")