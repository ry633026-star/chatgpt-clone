import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not configured")

if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not configured")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY is not configured")

ALGORITHM = os.getenv("ALGORITHM", "HS256")


ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "60",
    )
)
