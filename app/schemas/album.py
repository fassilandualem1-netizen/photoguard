from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class MediaItemBase(BaseModel):
    filename: str = Field(..., max_length=255, description="Filename or photo title")
    url: str = Field(..., description="High-resolution cloud storage URL")
    thumbnail_url: Optional[str] = Field(None, description="WebP preview/thumbnail URL")
    original_size: int = Field(0, description="Virtual original file size in bytes")
    compressed_size: int = Field(0, description="Actual compressed storage size in bytes")

class MediaItemCreate(MediaItemBase):
    pass

class MediaItemUpdate(BaseModel):
    is_selected: Optional[bool] = Field(None, description="Client photo selection status")
    client_notes: Optional[str] = Field(None, max_length=1000, description="Feedback or retouching instructions")

class MediaItemResponse(MediaItemBase):
    id: int
    album_id: int
    is_selected: bool
    client_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AlbumCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Album title")
    client_name: str = Field(..., min_length=1, max_length=255, description="Client or family name")
    allow_download: bool = Field(False, description="Enable or disable client high-res download")
    pin: Optional[str] = Field(None, min_length=6, max_length=6, description="Optional custom 6-digit PIN")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Initial album lifespan in days")

class AlbumUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    client_name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_locked: Optional[bool] = Field(None, description="Single Submit Lock toggle")
    allow_download: Optional[bool] = Field(None, description="Download permission toggle")

class AlbumExtendRequest(BaseModel):
    days: int = Field(..., ge=1, le=365, description="Number of days to extend album expiration")

class AlbumListItemResponse(BaseModel):
    id: int
    title: str
    client_name: str
    pin: str
    photographer_id: int
    is_locked: bool
    allow_download: bool
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_expired: bool = False
    submitted_at: Optional[datetime] = None
    media_count: int = 0
    selected_count: int = 0

    class Config:
        from_attributes = True

class AlbumDetailResponse(BaseModel):
    id: int
    title: str
    client_name: str
    pin: str
    photographer_id: int
    is_locked: bool
    allow_download: bool
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_expired: bool = False
    submitted_at: Optional[datetime] = None
    media_count: int = 0
    selected_count: int = 0
    media_items: List[MediaItemResponse] = []

    class Config:
        from_attributes = True
