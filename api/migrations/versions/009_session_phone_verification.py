"""visitor session phone verification

Revision ID: 009
Revises: 008
Create Date: 2026-07-04

Adds two columns to visitor_session_tokens:
  - verified_phone_hash: HMAC of the phone number this session has proven
    ownership of. Matches submissions.phone_hash when the visitor is the
    original submitter. NULL until verified.
  - verified_at: timestamp of the last successful verification. Drives
    the 24h rolling window enforced by /api/content's verified_until.
"""
from alembic import op
import sqlalchemy as sa


revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "visitor_session_tokens",
        sa.Column("verified_phone_hash", sa.String(64), nullable=True),
    )
    op.add_column(
        "visitor_session_tokens",
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("visitor_session_tokens", "verified_at")
    op.drop_column("visitor_session_tokens", "verified_phone_hash")