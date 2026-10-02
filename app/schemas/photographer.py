from typing import Optional
from pydantic import BaseModel, Field, model_validator

class SocialLinksUpdate(BaseModel):
    contact_phone: Optional[str] = Field(None, max_length=50, description="Photographer contact phone number")
    tiktok_url: Optional[str] = Field(None, max_length=255, description="TikTok profile URL")
    instagram_url: Optional[str] = Field(None, max_length=255, description="Instagram profile URL")
    telegram_url: Optional[str] = Field(None, max_length=255, description="Telegram profile or channel URL")
    youtube_url: Optional[str] = Field(None, max_length=255, description="YouTube channel URL")
    # Backwards-compatible alias fields
    phone_number: Optional[str] = Field(None, max_length=50, description="Alias for contact_phone")
    telegram_username: Optional[str] = Field(None, max_length=255, description="Alias for telegram_url")
    instagram: Optional[str] = Field(None, max_length=255, description="Alias for instagram_url")
    youtube: Optional[str] = Field(None, max_length=255, description="Alias for youtube_url")
    tiktok: Optional[str] = Field(None, max_length=255, description="Alias for tiktok_url")

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

class SocialLinksResponse(BaseModel):
    contact_phone: Optional[str] = None
    tiktok_url: Optional[str] = None
    instagram_url: Optional[str] = None
    telegram_url: Optional[str] = None
    youtube_url: Optional[str] = None
    # Aliases for client consumers
    phone_number: Optional[str] = None
    telegram_username: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    tiktok: Optional[str] = None
    message: Optional[str] = "Social links updated successfully."

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
