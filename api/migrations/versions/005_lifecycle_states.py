"""lifecycle status on modes and tokens

Revision ID: 005
Revises: 004
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- modes ---------------------------------------------------------------
    # Drop the hardcoded name CHECK so admin can create new modes.
    op.drop_constraint("ck_modes_name", "modes", type_="check")

    op.add_column(
        "modes",
        sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'active'")),
    )
    op.create_check_constraint(
        "ck_modes_status",
        "modes",
        "status IN ('active', 'inactive', 'archived')",
    )
    op.create_index("ix_modes_status", "modes", ["status"])

    # --- tokens --------------------------------------------------------------
    # Drop hardcoded mode CHECK; replace with FK to modes.name so deletion is gated.
    op.drop_constraint("ck_tokens_mode", "tokens", type_="check")
    op.create_foreign_key(
        "fk_tokens_mode",
        source_table="tokens",
        referent_table="modes",
        local_cols=["mode"],
        remote_cols=["name"],
        ondelete="RESTRICT",
    )
    # The mode FK requires a unique constraint on modes.name (already exists as unique=True).

    # Add status column, migrate existing bool state into it, then drop the bools.
    op.add_column(
        "tokens",
        sa.Column("status", sa.String(16), nullable=True),
    )
    op.execute(
        """
        UPDATE tokens SET status = CASE
            WHEN revoked = true THEN 'revoked'
            WHEN active = true THEN 'active'
            ELSE 'inactive'
        END
        """
    )
    op.alter_column("tokens", "status", nullable=False, server_default=sa.text("'active'"))
    op.create_check_constraint(
        "ck_tokens_status",
        "tokens",
        "status IN ('active', 'inactive', 'revoked')",
    )
    op.create_index("ix_tokens_status", "tokens", ["status"])

    op.drop_column("tokens", "active")
    op.drop_column("tokens", "revoked")
    # revoked_at and revoked_reason stay — they're still useful metadata when status='revoked'.


def downgrade() -> None:
    op.add_column("tokens", sa.Column("active", sa.Boolean(), nullable=True))
    op.add_column("tokens", sa.Column("revoked", sa.Boolean(), nullable=True))
    op.execute(
        """
        UPDATE tokens SET
            active  = (status IN ('active')),
            revoked = (status = 'revoked')
        """
    )
    op.alter_column("tokens", "active", nullable=False, server_default=sa.text("true"))
    op.alter_column("tokens", "revoked", nullable=False, server_default=sa.text("false"))

    op.drop_index("ix_tokens_status", table_name="tokens")
    op.drop_constraint("ck_tokens_status", "tokens", type_="check")
    op.drop_column("tokens", "status")

    op.drop_constraint("fk_tokens_mode", "tokens", type_="foreignkey")
    op.create_check_constraint(
        "ck_tokens_mode",
        "tokens",
        "mode IN ('dating', 'mix', 'friendship', 'professional')",
    )

    op.drop_index("ix_modes_status", table_name="modes")
    op.drop_constraint("ck_modes_status", "modes", type_="check")
    op.drop_column("modes", "status")
    op.create_check_constraint(
        "ck_modes_name",
        "modes",
        "name IN ('dating', 'mix', 'friendship', 'professional')",
    )