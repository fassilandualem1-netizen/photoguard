from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    PasswordChangeRequest,
    TokenResponse,
    UserResponse,
    UserUpdate
)
from app.schemas.album import (
    AlbumCreate,
    AlbumUpdate,
    AlbumExtendRequest,
    AlbumListItemResponse,
    AlbumDetailResponse,
    MediaItemCreate,
    MediaItemUpdate,
    MediaItemResponse,
)
from app.schemas.client import (
    ClientVerifyRequest,
    ClientSyncResponse,
    ClientMediaUpdateRequest,
    ClientSubmitResponse,
    ClientDownloadRequest,
    ClientDownloadResponse,
)
from app.schemas.admin import (
    PlatformStatsResponse,
    AdminUserUpdateRequest,
)

__all__ = [
    "LoginRequest",
    "RegisterRequest",
    "PasswordChangeRequest",
    "TokenResponse",
    "UserResponse",
    "UserUpdate",
    "AlbumCreate",
    "AlbumUpdate",
    "AlbumExtendRequest",
    "AlbumListItemResponse",
    "AlbumDetailResponse",
    "MediaItemCreate",
    "MediaItemUpdate",
    "MediaItemResponse",
    "ClientVerifyRequest",
    "ClientSyncResponse",
    "ClientMediaUpdateRequest",
    "ClientSubmitResponse",
    "ClientDownloadRequest",
    "ClientDownloadResponse",
    "PlatformStatsResponse",
    "AdminUserUpdateRequest",
]
