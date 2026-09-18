"""PhotoGuard API Routers"""
from app.api.auth import router as auth_router
from app.api.albums import router as albums_router

__all__ = ["auth_router", "albums_router"]

