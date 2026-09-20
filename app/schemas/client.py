from typing import Optional, List
from pydantic import BaseModel, Field

class ClientVerifyRequest(BaseModel):
    pin: str = Field(..., min_length=6, max_length=6, description="6-digit album access PIN")

class ClientSyncResponse(BaseModel):
    pin: str
    version: int
    is_locked: bool

class ClientMediaUpdateRequest(BaseModel):
    pin: str = Field(..., min_length=6, max_length=6, description="6-digit album access PIN")
    is_selected: Optional[bool] = Field(None, description="Selection status of the photo")
    client_notes: Optional[str] = Field(None, description="Retouching notes or feedback")

class ClientSubmitResponse(BaseModel):
    message: str
    pin: str
    is_locked: bool

class ClientDownloadRequest(BaseModel):
    pin: str = Field(..., min_length=6, max_length=6, description="6-digit album access PIN")

class ClientDownloadResponse(BaseModel):
    pin: str
    allow_download: bool
    download_urls: List[str] = []

class FaceSearchResponse(BaseModel):
    pin: str
    total_matched: int
    matched_media_ids: List[int]
    message: str
