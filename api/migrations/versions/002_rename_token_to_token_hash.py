"""switch visitor PKs to uuid, rename token to token_hash

Revision ID: 002
Revises: 001
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No production data yet — safe to drop and recreate with UUID PKs.
    op.drop_index("ix_vst_token", table_name="visitor_session_tokens")
    op.drop_index("ix_vst_visitor_id", table_name="visitor_session_tokens")
    op.drop_table("visitor_session_tokens")
    op.drop_table("visitors")

    op.create_table(
        "visitors",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("phone", sa.String(32), nullable=True, unique=True),
        sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "visitor_session_tokens",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "visitor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("visitors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("superseded_grace_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_vst_visitor_id", "visitor_session_tokens", ["visitor_id"])
    op.create_index("ix_vst_token_hash", "visitor_session_tokens", ["token_hash"])


def downgrade() -> None:
    op.drop_index("ix_vst_token_hash", table_name="visitor_session_tokens")
    op.drop_index("ix_vst_visitor_id", table_name="visitor_session_tokens")
    op.drop_table("visitor_session_tokens")
    op.drop_table("visitors")

    op.create_table(
        "visitors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("phone", sa.String(), nullable=True, unique=True),
        sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_table(
        "visitor_session_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("visitor_id", sa.Integer(), sa.ForeignKey("visitors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(), nullable=False, unique=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("superseded_grace_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_vst_visitor_id", "visitor_session_tokens", ["visitor_id"])
    op.create_index("ix_vst_token", "visitor_session_tokens", ["token"])