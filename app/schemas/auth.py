from typing import Optional
from pydantic import BaseModel, Field
from app.models.user import UserRole

class LoginRequest(BaseModel):
    email: str = Field(..., description="Registered user email address")
    password: str = Field(..., min_length=6, description="User password")

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    storage_quota_limit: int
    storage_used: int
    telegram_chat_id: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
