"""chat: conversations + messages tables

Revision ID: 010
Revises: 009
Create Date: 2026-07-04

Instant chat foundation. AES-GCM encryption on message content, same
pattern as submissions.name_encrypted. Content type future-proofs for
media (image/file/etc) without a message table migration.

Messages use UUID v7 primary keys (time-ordered) for cheap ORDER BY id
pagination. Every other table stays on v4.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---- conversations ----
    op.create_table(
        "conversations",
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
        sa.Column(
            "submission_id",
            UUID(as_uuid=True),
            sa.ForeignKey("submissions.id", ondelete="SET NULL"),
            nullable=True,
            comment="null for future declined-visitor chats; today always set",
        ),
        sa.Column("kind", sa.String(16), nullable=False, server_default="instant"),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
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
        sa.Column(
            "last_message_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="powers admin inbox ordering + preview",
        ),
        sa.Column(
            "unread_by_owner",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.CheckConstraint(
            "kind IN ('instant', 'ai')", name="conversations_kind_check"
        ),
        sa.CheckConstraint(
            "status IN ('open', 'closed', 'archived')",
            name="conversations_status_check",
        ),
    )
    op.create_index(
        "ix_conversations_visitor_id", "conversations", ["visitor_id"]
    )
    op.create_index(
        "ix_conversations_last_message_at",
        "conversations",
        ["last_message_at"],
        postgresql_where=sa.text("last_message_at IS NOT NULL"),
    )
    op.create_index(
        "ix_conversations_unread_by_owner",
        "conversations",
        ["unread_by_owner"],
        postgresql_where=sa.text("unread_by_owner = true"),
    )
    # One instant conversation per visitor. Enforced at DB level; the
    # get-or-create endpoint upholds it at the app level.
    op.create_index(
        "ux_conversations_visitor_instant",
        "conversations",
        ["visitor_id"],
        unique=True,
        postgresql_where=sa.text("kind = 'instant'"),
    )

    # ---- messages ----
    op.create_table(
        "messages",
        # v7 UUIDs generated app-side. No server_default; the model provides one.
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sender", sa.String(16), nullable=False),
        sa.Column(
            "content_type",
            sa.String(16),
            nullable=False,
            server_default="text",
            comment="text | image | file | system — future-proofs for media",
        ),
        sa.Column("content_encrypted", sa.LargeBinary, nullable=False),
        sa.Column(
            "content_metadata",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
            comment="content_type-specific fields (dimensions, filename, etc)",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "sender IN ('visitor', 'owner', 'ai', 'system')",
            name="messages_sender_check",
        ),
        sa.CheckConstraint(
            "content_type IN ('text', 'image', 'file', 'system')",
            name="messages_content_type_check",
        ),
    )
    # Ordering index — descending because we render newest-first, paginate up
    op.create_index(
        "ix_messages_conversation_id_id",
        "messages",
        ["conversation_id", sa.text("id DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_messages_conversation_id_id", table_name="messages")
    op.drop_table("messages")

    op.drop_index(
        "ux_conversations_visitor_instant", table_name="conversations"
    )
    op.drop_index(
        "ix_conversations_unread_by_owner", table_name="conversations"
    )
    op.drop_index(
        "ix_conversations_last_message_at", table_name="conversations"
    )
    op.drop_index("ix_conversations_visitor_id", table_name="conversations")
    op.drop_table("conversations")