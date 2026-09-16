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


class WatermarkUpdateRequest(BaseModel):
    watermark_text: Optional[str] = None
    watermark_logo_url: Optional[str] = None
    watermark_opacity: Optional[float] = None
    watermark_position: Optional[str] = None


class WatermarkProfileResponse(BaseModel):
    watermark_text: str
    watermark_logo_url: Optional[str] = None
    watermark_opacity: float
    watermark_position: str
