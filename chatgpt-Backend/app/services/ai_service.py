from threading import Event

from app.services.local_ai_service import (
    generate_local_response,
    stream_local_response,
)


def generate_ai_response(
    messages: list[dict[str, str]],
) -> str:
    return generate_local_response(messages)


def stream_ai_response(
    messages: list[dict[str, str]],
    stop_event: Event,
):
    return stream_local_response(messages, stop_event)
