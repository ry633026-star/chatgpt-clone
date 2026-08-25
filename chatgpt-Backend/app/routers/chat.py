import uuid
from app.services.ai_service import generate_ai_response
from fastapi.responses import StreamingResponse

from app.services.ai_service import (
    stream_ai_response,
)
from threading import Event

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
    RenameConversationRequest,
)

# Use your existing JWT dependency here.
from app.routers.auth import get_current_user
from app.models.user import User


router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"],
)
# To keep track of running AI generation for each conversation (for stop functionality)
active_generations: dict[str, Event] = {}


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
    db.flush()

    previous_messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
    ).all()

    ai_messages = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in previous_messages
    ]

    try:
        assistant_content = generate_ai_response(ai_messages)

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {exc}",
        )

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=assistant_content,
    )

    db.add(assistant_message)

    db.commit()

    db.refresh(user_message)
    db.refresh(assistant_message)

    return [
        user_message,
        assistant_message,
    ]


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
def get_messages(
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

    messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    ).all()

    return messages


# streaming response
@router.post("/conversations/{conversation_id}/messages/stream")
def stream_message(
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

    stop_event = Event()
    generation_key = str(conversation.id)
    active_generations[generation_key] = stop_event

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=content,
    )

    db.add(user_message)
    db.commit()

    previous_messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
    ).all()

    ai_messages = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in previous_messages
    ]

    def generate():
        full_response = ""

        try:
            for chunk in stream_ai_response(
                ai_messages,
                stop_event,
            ):
                full_response += chunk
                yield chunk

            if full_response:
                assistant_message = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=full_response,
                )

                db.add(assistant_message)
                db.commit()

        except Exception as exc:
            db.rollback()
            print(f"Streaming AI error: {exc}")

        finally:
            active_generations.pop(generation_key, None)

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# stop generation
@router.post("/conversations/{conversation_id}/messages/stop")
def stop_message_generation(
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

    generation_key = str(conversation.id)

    stop_event = active_generations.get(generation_key)

    if stop_event:
        stop_event.set()

    return {"message": "Generation stopped"}


# chat/conversation/rename
@router.patch("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: uuid.UUID,
    data: RenameConversationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = data.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Title cannot be empty",
        )

    if len(title) > 100:
        raise HTTPException(
            status_code=400,
            detail="Title cannot exceed 100 characters",
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

    conversation.title = title

    db.commit()
    db.refresh(conversation)

    return {
        "id": str(conversation.id),
        "title": conversation.title,
    }
