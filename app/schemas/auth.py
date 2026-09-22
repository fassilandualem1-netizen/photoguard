from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator

class LoginRequest(BaseModel):
    email: Optional[str] = Field(None, description="Registered user email address")
    username: Optional[str] = Field(None, description="Registered user email or username")
    password: str = Field(..., description="User password")

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
    full_name: str = "Photographer"
    role: str = "photographer"
    parent_owner_id: Optional[int] = None
    storage_quota_limit: Optional[int] = 5368709120
    storage_used: Optional[int] = 0
    telegram_chat_id: Optional[str] = None
    studio_logo_url: Optional[str] = None
    brand_color: Optional[str] = "#F59E0B"
    subscription_plan: Optional[str] = "basic"
    is_verified: Optional[bool] = False
    needs_password_change: Optional[bool] = True
    is_active: Optional[bool] = True

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v: Any) -> str:
        if hasattr(v, "value"):
            v = v.value
        s = str(v or "photographer").lower().replace("userrole.", "").strip()
        return s if s in ["admin", "photographer", "owner", "assistant"] else "photographer"

    @field_validator("storage_quota_limit", mode="before")
    @classmethod
    def normalize_quota(cls, v: Any) -> int:
        try:
            return int(v) if v is not None else 5368709120
        except (ValueError, TypeError):
            return 5368709120

    @field_validator("storage_used", mode="before")
    @classmethod
    def normalize_used(cls, v: Any) -> int:
        try:
            return int(v) if v is not None else 0
        except (ValueError, TypeError):
            return 0

    @field_validator("is_active", "is_verified", "needs_password_change", mode="before")
    @classmethod
    def normalize_bools(cls, v: Any) -> bool:
        if v is None:
            return False
        return bool(v)

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class EmergencyAdminLoginRequest(BaseModel):
    admin_secret: str = Field(..., description="Emergency master admin secret token")
