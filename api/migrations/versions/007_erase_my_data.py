"""erase-my-data: extend submissions status + audit log

Revision ID: 007
Revises: 006
Create Date: 2026-07-02

Adds two new terminal-ish statuses to submissions:
  - erase_requested: visitor asked; admin hasn't finalized yet.
    Identity fields intact so admin can verify identity of requester.
  - erased: admin finalized. Identity fields NULL. Answers + outcome +
    attempt_number preserved for anonymized funnel.

Also creates erasure_log: append-only audit trail. Once identity is
nulled, this is the only record of whose erasure happened.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------- submissions.status CHECK constraint extension -------
    # The status column is a plain varchar with a CHECK constraint (not a
    # PG ENUM), so extension is: drop old check, add new check.
    op.drop_constraint("submissions_status_check", "submissions", type_="check")
    op.create_check_constraint(
        "submissions_status_check",
        "submissions",
        "status IN ('pending', 'read', 'archived', 'erase_requested', 'erased')",
    )

    # ------- erasure_log table -------
    op.create_table(
        "erasure_log",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "submission_id",
            UUID(as_uuid=True),
            # ondelete SET NULL: if the submission row is ever purged (future),
            # the audit trail survives with a dangling reference. Better than
            # cascading the audit into oblivion.
            sa.ForeignKey("submissions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("mode", sa.String(32), nullable=False),
        sa.Column(
            "phone_hash",
            sa.String(64),
            nullable=True,
            comment="phone_hash at time of erasure — lets admin correlate "
                    "erasure events without exposing the phone number",
        ),
        sa.Column(
            "requested_via",
            sa.String(16),
            nullable=False,
            comment="'visitor' (self-service via session cookie) or 'admin' "
                    "(owner erased on behalf)",
        ),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "finalized_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "finalized_by",
            sa.String(64),
            nullable=True,
            comment="admin username who finalized; NULL until finalized",
        ),
        sa.CheckConstraint(
            "requested_via IN ('visitor', 'admin')",
            name="erasure_log_requested_via_check",
        ),
    )

    op.create_index(
        "ix_erasure_log_submission_id",
        "erasure_log",
        ["submission_id"],
    )
    op.create_index(
        "ix_erasure_log_phone_hash",
        "erasure_log",
        ["phone_hash"],
        postgresql_where=sa.text("phone_hash IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_erasure_log_phone_hash", table_name="erasure_log")
    op.drop_index("ix_erasure_log_submission_id", table_name="erasure_log")
    op.drop_table("erasure_log")

    op.drop_constraint("submissions_status_check", "submissions", type_="check")
    op.create_check_constraint(
        "submissions_status_check",
        "submissions",
        "status IN ('pending', 'read', 'archived')",
    )