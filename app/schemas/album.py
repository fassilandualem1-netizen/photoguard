from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class MediaItemBase(BaseModel):
    filename: str = Field(..., max_length=255, description="Filename or photo title")
    url: str = Field(..., description="High-resolution cloud storage URL")
    thumbnail_url: Optional[str] = Field(default=None, description="WebP preview/thumbnail URL")
    original_size: int = Field(default=0, description="Virtual original file size in bytes")
    compressed_size: int = Field(default=0, description="Actual compressed storage size in bytes")

class MediaItemCreate(MediaItemBase):
    pass

class MediaItemUpdate(BaseModel):
    is_selected: Optional[bool] = Field(default=None, description="Client photo selection status")
    client_notes: Optional[str] = Field(default=None, max_length=1000, description="Feedback or retouching instructions")

class MediaItemResponse(MediaItemBase):
    id: int
    album_id: int
    is_selected: bool = Field(default=False)
    client_notes: Optional[str] = Field(default=None)
    created_at: Optional[datetime] = Field(default=None)

    class Config:
        from_attributes = True

class AlbumCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Album title")
    client_name: str = Field(..., min_length=1, max_length=255, description="Client or family name")
    allow_download: bool = Field(default=False, description="Enable or disable client high-res download")
    pin: Optional[str] = Field(default=None, min_length=6, max_length=6, description="Optional custom 6-digit PIN")
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365, description="Initial album lifespan in days")

class AlbumUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    client_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    is_locked: Optional[bool] = Field(default=None, description="Single Submit Lock toggle")
    allow_download: Optional[bool] = Field(default=None, description="Download permission toggle")

class AlbumExtendRequest(BaseModel):
    days: int = Field(..., ge=1, le=365, description="Number of days to extend album expiration")

class AlbumListItemResponse(BaseModel):
    id: int
    title: Optional[str] = Field(default="Untitled Album")
    client_name: Optional[str] = Field(default="Valued Client")
    pin: str = Field(default="")
    photographer_id: int
    is_locked: bool = Field(default=False)
    allow_download: bool = Field(default=False)
    created_at: Optional[datetime] = Field(default=None)
    expires_at: Optional[datetime] = Field(default=None)
    is_expired: bool = Field(default=False)
    submitted_at: Optional[datetime] = Field(default=None)
    media_count: int = Field(default=0)
    selected_count: int = Field(default=0)

    class Config:
        from_attributes = True

class AlbumDetailResponse(BaseModel):
    id: int
    title: Optional[str] = Field(default="Untitled Album")
    client_name: Optional[str] = Field(default="Valued Client")
    pin: str = Field(default="")
    photographer_id: int
    is_locked: bool = Field(default=False)
    allow_download: bool = Field(default=False)
    created_at: Optional[datetime] = Field(default=None)
    expires_at: Optional[datetime] = Field(default=None)
    is_expired: bool = Field(default=False)
    submitted_at: Optional[datetime] = Field(default=None)
    media_count: int = Field(default=0)
    selected_count: int = Field(default=0)
    media_items: List[MediaItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

# Backwards-compatible alias
AlbumResponse = AlbumDetailResponse
