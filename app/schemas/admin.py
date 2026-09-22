from typing import Optional, List
from datetime import datetime
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

class PlanConfigResponse(BaseModel):
    id: int
    plan_name: str
    storage_quota_bytes: int
    storage_quota_gb: float
    default_lifespan_days: int
    max_lifespan_days: int
    can_enable_downloads: bool
    can_customize_branding: bool
    can_extend_lifespan: bool
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PlanConfigUpdateRequest(BaseModel):
    storage_quota_bytes: Optional[int] = Field(None, ge=1048576, description="Quota in bytes (min 1 MB)")
    default_lifespan_days: Optional[int] = Field(None, ge=1, le=365, description="Default album lifespan in days")
    max_lifespan_days: Optional[int] = Field(None, ge=1, le=365, description="Maximum album lifespan in days")
    can_enable_downloads: Optional[bool] = Field(None, description="Allow client photo downloads")
    can_customize_branding: Optional[bool] = Field(None, description="Allow custom logo and brand colors")
    can_extend_lifespan: Optional[bool] = Field(None, description="Allow photographers to extend album expiration")

