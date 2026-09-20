from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.user import UserRole
from app.schemas.auth import UserResponse

class PlatformStatsResponse(BaseModel):
    total_photographers: int
    total_storage_used_bytes: int
    total_storage_used_gb: float
    total_albums: int
    total_photos: int

class AdminUserUpdateRequest(BaseModel):
    subscription_plan: Optional[str] = Field(None, description="Subscription tier: 'basic' or 'studio'")
    is_verified: Optional[bool] = Field(None, description="Verification badge status")
    is_active: Optional[bool] = Field(None, description="Account active status (False to suspend)")
    storage_quota_limit: Optional[int] = Field(None, description="Custom storage quota in bytes")
