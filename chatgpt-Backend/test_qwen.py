from app.services.local_ai_service import (
    generate_local_response,
)


messages = [
    {
        "role": "user",
        "content": "Hello! Who are you?",
    }
]


response = generate_local_response(messages)

print("\nAI:")
print(response)
