import uuid
from app.services.ai_service import generate_ai_response
from fastapi.responses import StreamingResponse

from app.services.ai_service import (
    stream_ai_response,
)
from threading import Event

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
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
    EditMessageRequest,
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


def get_next_position(db: Session, conversation_id: uuid.UUID) -> int:
    max_pos = db.scalar(
        select(func.max(Message.position)).where(
            Message.conversation_id == conversation_id
        )
    )
    return (max_pos + 1) if max_pos is not None else 0


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

    next_pos = get_next_position(db, conversation.id)

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=content,
        position=next_pos,
    )

    db.add(user_message)
    db.flush()

    previous_messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.position.asc(), Message.created_at.asc())
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
        position=next_pos + 1,
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
        .order_by(Message.position.asc(), Message.created_at.asc())
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

    next_pos = get_next_position(db, conversation.id)

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=content,
        position=next_pos,
    )

    db.add(user_message)
    db.commit()

    previous_messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.position.asc(), Message.created_at.asc())
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
                    position=next_pos + 1,
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


# chat/conversation/regenerate
@router.post("/conversations/{conversation_id}/messages/regenerate")
def regenerate_message(
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
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.position.asc(), Message.created_at.asc())
    ).all()

    if not messages:
        raise HTTPException(
            status_code=400,
            detail="No messages to regenerate",
        )

    # Find the latest user message
    latest_user_message = next(
        (message for message in reversed(messages) if message.role == "user"),
        None,
    )

    if not latest_user_message:
        raise HTTPException(
            status_code=400,
            detail="No user message found",
        )

    # Remove assistant messages generated after the latest user message's position
    later_assistant_messages = db.scalars(
        select(Message).where(
            Message.conversation_id == conversation.id,
            Message.position > latest_user_message.position,
        )
    ).all()

    for old_message in later_assistant_messages:
        db.delete(old_message)

    db.commit()

    remaining_messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.position.asc(), Message.created_at.asc())
    ).all()

    ai_messages = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in remaining_messages
    ]

    next_assistant_pos = latest_user_message.position + 1

    stop_event = Event()
    generation_key = str(conversation.id)
    active_generations[generation_key] = stop_event

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
                    position=next_assistant_pos,
                )

                db.add(assistant_message)
                db.commit()

        except Exception as exc:
            db.rollback()
            print(f"Regeneration error: {exc}")

        finally:
            active_generations.pop(
                generation_key,
                None,
            )

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# edit message
@router.patch("/conversations/{conversation_id}/messages/{message_id}")
def edit_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    data: EditMessageRequest,
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

    message = db.scalar(
        select(Message).where(
            Message.id == message_id,
            Message.conversation_id == conversation.id,
            Message.role == "user",
        )
    )

    if not message:
        raise HTTPException(
            status_code=404,
            detail="User message not found",
        )

    message.content = content

    db.commit()
    db.refresh(message)

    return {
        "id": str(message.id),
        "content": message.content,
        "position": message.position,
    }


# edit resend message
@router.post("/conversations/{conversation_id}/messages/{message_id}/edit-resend")
def edit_and_resend_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    data: EditMessageRequest,
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

    message = db.scalar(
        select(Message).where(
            Message.id == message_id,
            Message.conversation_id == conversation.id,
            Message.role == "user",
        )
    )

    if not message:
        raise HTTPException(
            status_code=404,
            detail="User message not found",
        )

    # Update edited message
    message.content = content

    # Find messages after edited message by explicit position ordering
    later_messages = db.scalars(
        select(Message).where(
            Message.conversation_id == conversation.id,
            Message.position > message.position,
        )
    ).all()

    # Delete old assistant/user branch
    for old_message in later_messages:
        db.delete(old_message)

    db.commit()

    # Reload remaining conversation
    remaining_messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.position.asc(), Message.created_at.asc())
    ).all()

    ai_messages = [
        {
            "role": item.role,
            "content": item.content,
        }
        for item in remaining_messages
    ]

    next_assistant_pos = message.position + 1

    stop_event = Event()

    generation_key = str(conversation.id)

    active_generations[generation_key] = stop_event

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
                    position=next_assistant_pos,
                )

                db.add(assistant_message)
                db.commit()

        except Exception as exc:
            db.rollback()
            print(f"Edit/resend error: {exc}")

        finally:
            active_generations.pop(
                generation_key,
                None,
            )

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
