from app.services.local_ai_service import (
    generate_local_response,
)


def generate_ai_response(
    messages: list[dict[str, str]],
) -> str:

    return generate_local_response(messages)
