"""chat statuses: read receipts, typing state, owner receipts toggle, owner status

Revision ID: 011
Revises: 010
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("read_by_recipient_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_messages_conv_unread_recipient",
        "messages",
        ["conversation_id"],
        postgresql_where=sa.text("read_by_recipient_at IS NULL"),
    )

    op.add_column(
        "conversations",
        sa.Column(
            "owner_receipts_enabled",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "conversations",
        sa.Column(
            "unread_by_visitor",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_conversations_unread_by_visitor",
        "conversations",
        ["unread_by_visitor"],
        postgresql_where=sa.text("unread_by_visitor = true"),
    )


def downgrade() -> None:
    op.drop_index("ix_conversations_unread_by_visitor", table_name="conversations")
    op.drop_column("conversations", "unread_by_visitor")
    op.drop_column("conversations", "owner_receipts_enabled")
    op.drop_index("ix_messages_conv_unread_recipient", table_name="messages")
    op.drop_column("messages", "read_by_recipient_at")