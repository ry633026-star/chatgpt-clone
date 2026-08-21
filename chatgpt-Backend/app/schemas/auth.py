import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=100,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("email")
    @classmethod
    def validate_gmail(cls, value: EmailStr) -> str:
        email = str(value).strip().lower()

        if not email.endswith("@gmail.com"):
            raise ValueError("Only @gmail.com email addresses are allowed")

        return email


class LoginRequest(BaseModel):
    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("email")
    @classmethod
    def validate_gmail(cls, value: EmailStr) -> str:
        email = str(value).strip().lower()

        if not email.endswith("@gmail.com"):
            raise ValueError("Only @gmail.com email addresses are allowed")

        return email


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr

    model_config = {
        "from_attributes": True,
    }
