"""allow null identity on erased submissions

Revision ID: 008
Revises: 007
Create Date: 2026-07-02

The original submissions_outcome_payload_check enforced identity presence
based on outcome. Erasure introduces a third valid state: a submitted row
whose identity has been nulled. Extend the constraint to accept it.

New shape:
  - submitted + status != 'erased'  → identity fields NOT NULL
  - submitted + status == 'erased'  → identity fields NULL (crypto-shredded)
  - declined                        → identity fields NULL (always)
"""
from alembic import op


revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "submissions_outcome_payload_check", "submissions", type_="check"
    )
    op.create_check_constraint(
        "submissions_outcome_payload_check",
        "submissions",
        # Three legal states now:
        #   1. submitted + not erased → identity present
        #   2. submitted + erased    → identity nulled (crypto-shredded)
        #   3. declined              → identity null
        "(outcome = 'submitted' AND status != 'erased' "
        " AND name_encrypted IS NOT NULL "
        " AND phone_encrypted IS NOT NULL AND phone_hash IS NOT NULL) "
        "OR (outcome = 'submitted' AND status = 'erased' "
        " AND name_encrypted IS NULL "
        " AND phone_encrypted IS NULL AND phone_hash IS NULL) "
        "OR (outcome = 'declined' AND name_encrypted IS NULL "
        " AND phone_encrypted IS NULL AND phone_hash IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "submissions_outcome_payload_check", "submissions", type_="check"
    )
    op.create_check_constraint(
        "submissions_outcome_payload_check",
        "submissions",
        "(outcome = 'submitted' AND name_encrypted IS NOT NULL "
        " AND phone_encrypted IS NOT NULL AND phone_hash IS NOT NULL) "
        "OR (outcome = 'declined' AND name_encrypted IS NULL "
        " AND phone_encrypted IS NULL AND phone_hash IS NULL)",
    )