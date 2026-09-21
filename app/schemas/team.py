from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class TeamMemberCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255, description="Assistant full name")
    email: str = Field(..., min_length=5, max_length=255, description="Assistant login email")
    password: Optional[str] = Field(None, min_length=6, max_length=128, description="Optional custom password (auto-generated if empty)")

class TeamMemberResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    parent_owner_id: Optional[int] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    temp_password: Optional[str] = Field(None, description="Plain text password returned only upon creation")

    class Config:
        from_attributes = True
