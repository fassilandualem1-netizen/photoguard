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

class PasswordChangeRequest(BaseModel):
    current_password: Optional[str] = Field(None, description="Current password for verification")
    new_password: str = Field(..., min_length=6, description="New secure password for the user account")
    confirm_password: Optional[str] = Field(None, min_length=6, description="Confirmation of new password")

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255, description="Updated full name")
    telegram_chat_id: Optional[str] = Field(None, max_length=50, description="Telegram chat ID for instant alerts")
    studio_logo_url: Optional[str] = Field(None, max_length=1024, description="Custom studio logo URL for client white-labeling")
    brand_color: Optional[str] = Field(None, max_length=50, description="Custom studio brand accent color (e.g. #F59E0B)")

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    storage_quota_limit: int
    storage_used: int
    telegram_chat_id: Optional[str] = None
    studio_logo_url: Optional[str] = None
    brand_color: Optional[str] = "#F59E0B"
    subscription_plan: str = "basic"
    is_verified: bool = False
    needs_password_change: bool = True
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class EmergencyAdminLoginRequest(BaseModel):
    admin_secret: str = Field(..., description="Emergency master admin secret token")
