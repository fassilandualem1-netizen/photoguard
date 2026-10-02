from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator

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
    brand_color: Optional[str] = Field(None, max_length=50, description="Custom studio brand accent color (e.g. #D97706)")
    brand_accent_color: Optional[str] = Field(None, max_length=50, description="Custom studio brand accent color (e.g. #D97706)")
    contact_phone: Optional[str] = Field(None, max_length=50, description="Contact phone number")
    tiktok_url: Optional[str] = Field(None, max_length=255, description="TikTok profile URL")
    instagram_url: Optional[str] = Field(None, max_length=255, description="Instagram profile URL")
    telegram_url: Optional[str] = Field(None, max_length=255, description="Telegram channel/profile URL")
    youtube_url: Optional[str] = Field(None, max_length=255, description="YouTube channel URL")
    # Backwards-compatible aliases
    phone_number: Optional[str] = Field(None, max_length=50)
    telegram_username: Optional[str] = Field(None, max_length=255)
    instagram: Optional[str] = Field(None, max_length=255)
    youtube: Optional[str] = Field(None, max_length=255)
    tiktok: Optional[str] = Field(None, max_length=255)

    @model_validator(mode="after")
    def sync_aliases(self):
        if not self.contact_phone and self.phone_number:
            self.contact_phone = self.phone_number
        if not self.telegram_url and self.telegram_username:
            self.telegram_url = self.telegram_username
        if not self.instagram_url and self.instagram:
            self.instagram_url = self.instagram
        if not self.youtube_url and self.youtube:
            self.youtube_url = self.youtube
        if not self.tiktok_url and self.tiktok:
            self.tiktok_url = self.tiktok
        return self

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
    brand_color: Optional[str] = "#D97706"
    brand_accent_color: Optional[str] = "#D97706"
    contact_phone: Optional[str] = None
    tiktok_url: Optional[str] = None
    instagram_url: Optional[str] = None
    telegram_url: Optional[str] = None
    youtube_url: Optional[str] = None
    # Aliases
    phone_number: Optional[str] = None
    telegram_username: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    tiktok: Optional[str] = None
    subscription_plan: Optional[str] = "basic"
    is_verified: Optional[bool] = False
    needs_password_change: Optional[bool] = True
    token_version: Optional[int] = 1
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

    @model_validator(mode="after")
    def populate_aliases(self):
        self.phone_number = self.phone_number or self.contact_phone
        self.telegram_username = self.telegram_username or self.telegram_url
        self.instagram = self.instagram or self.instagram_url
        self.youtube = self.youtube or self.youtube_url
        self.tiktok = self.tiktok or self.tiktok_url
        return self

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class EmergencyAdminLoginRequest(BaseModel):
    admin_secret: str = Field(..., description="Emergency master admin secret token")
