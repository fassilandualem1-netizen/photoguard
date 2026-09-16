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
