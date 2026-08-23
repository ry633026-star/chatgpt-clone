from app.core.config import OPENAI_API_KEY


def generate_ai_response(
    messages: list[dict[str, str]],
) -> str:

    if not OPENAI_API_KEY:
        return "AI provider is not configured yet."

    # OpenAI implementation will go here.
    # Local Qwen implementation can be added here later.

    return "AI provider is configured, " "but the model is not connected yet."
