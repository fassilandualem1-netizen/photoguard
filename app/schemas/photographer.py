from typing import Optional
from pydantic import BaseModel, Field

class SocialLinksUpdate(BaseModel):
    contact_phone: Optional[str] = Field(None, max_length=50, description="Photographer contact phone number")
    tiktok_url: Optional[str] = Field(None, max_length=255, description="TikTok profile URL")
    instagram_url: Optional[str] = Field(None, max_length=255, description="Instagram profile URL")
    telegram_url: Optional[str] = Field(None, max_length=255, description="Telegram profile or channel URL")
    youtube_url: Optional[str] = Field(None, max_length=255, description="YouTube channel URL")

class SocialLinksResponse(BaseModel):
    contact_phone: Optional[str] = None
    tiktok_url: Optional[str] = None
    instagram_url: Optional[str] = None
    telegram_url: Optional[str] = None
    youtube_url: Optional[str] = None
    message: Optional[str] = "Social links updated successfully."

    class Config:
        from_attributes = True
