import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
)

# Use your existing JWT dependency here.
from app.core.security import get_current_user
from app.models.user import User


router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"],
)


@router.post(
    "/conversations",
    response_model=ConversationResponse,
)
def create_conversation(
    data: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = Conversation(
        user_id=current_user.id,
        title=data.title.strip() or "New chat",
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


@router.get(
    "/conversations",
    response_model=list[ConversationResponse],
)
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = db.scalars(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    ).all()

    return conversations


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    db.delete(conversation)
    db.commit()

    return {"message": "Conversation deleted"}


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
def send_message(
    conversation_id: uuid.UUID,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = data.content.strip()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty",
        )

    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=content,
    )

    db.add(user_message)

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=(
            "This is a temporary AI response. "
            "The real AI model will be connected next."
        ),
    )

    db.add(assistant_message)

    db.commit()

    db.refresh(user_message)
    db.refresh(assistant_message)

    return [
        user_message,
        assistant_message,
    ]
