from typing import Optional
from pydantic import BaseModel, Field
from app.models.user import UserRole

class LoginRequest(BaseModel):
    email: str = Field(..., description="Registered user email address")
    password: str = Field(..., min_length=6, description="User password")

class RegisterRequest(BaseModel):
    email: str = Field(..., description="Photographer email address")
    password: str = Field(..., min_length=6, description="User password")
    full_name: str = Field(..., min_length=2, max_length=255, description="Photographer full name or studio name")

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255, description="Updated full name")
    telegram_chat_id: Optional[str] = Field(None, max_length=50, description="Telegram chat ID for instant alerts")

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    storage_quota_limit: int
    storage_used: int
    telegram_chat_id: Optional[str] = None
    subscription_plan: str = "basic"
    is_verified: bool = False
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
