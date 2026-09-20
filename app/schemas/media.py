from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field

class MediaItemBase(BaseModel):
    filename: Optional[str] = Field(default="photo.jpg", max_length=255, description="Filename or photo title")
    url: str = Field(..., description="High-resolution cloud or local storage URL")
    thumbnail_url: Optional[str] = Field(default=None, description="WebP preview/thumbnail URL")
    original_size: Optional[int] = Field(default=0, description="Virtual original file size in bytes")
    compressed_size: Optional[int] = Field(default=0, description="Actual compressed storage size in bytes")
    face_encodings: Optional[Any] = Field(default=None, description="Optional face feature vectors")

class MediaItemCreate(MediaItemBase):
    pass

class MediaItemUpdate(BaseModel):
    is_selected: Optional[bool] = Field(default=None, description="Client photo selection status")
    client_notes: Optional[str] = Field(default=None, max_length=1000, description="Feedback or retouching instructions")

class MediaItemResponse(BaseModel):
    id: int
    album_id: int
    filename: Optional[str] = Field(default="photo.jpg")
    url: str
    thumbnail_url: Optional[str] = Field(default=None)
    original_size: Optional[int] = Field(default=0)
    compressed_size: Optional[int] = Field(default=0)
    is_selected: Optional[bool] = Field(default=False)
    client_notes: Optional[str] = Field(default=None)
    face_encodings: Optional[Any] = Field(default=None)
    created_at: Optional[datetime] = Field(default=None)

    class Config:
        from_attributes = True
