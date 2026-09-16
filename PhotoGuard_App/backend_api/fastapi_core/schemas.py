from typing import Optional

from pydantic import BaseModel


class PublicPhotoResponse(BaseModel):
    """Safe media contract; storage-origin URLs are intentionally absent."""

    id: int
    filename: str
    token: str
    url: str
    media_type: str = "image"
    selected: Optional[bool] = None


class BrandingUpdateRequest(BaseModel):
    brand_color: Optional[str] = None
    logo_url: Optional[str] = None
    custom_welcome_message: Optional[str] = None


class PublicBrandingResponse(BaseModel):
    brand_color: str
    logo_url: Optional[str] = None
    custom_welcome_message: Optional[str] = None
