"""add conversations and messages

Revision ID: 529e3142867e
Revises: cc0d8c11a09b
Create Date: 2026-08-23 13:57:59.891394

"""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "529e3142867e"
down_revision: Union[str, Sequence[str], None] = "cc0d8c11a09b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create conversations table
    op.create_table(
        "conversations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False, default="New chat"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # Create messages table
    op.create_table(
        "messages",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "conversation_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Add index for messages
    op.create_index(
        op.f("ix_messages_conversation_id"),
        "messages",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_conversations_user_id"), "conversations", ["user_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop messages table
    op.drop_table("messages")
    # Drop conversations table
    op.drop_table("conversations")
