from datetime import datetime
from typing import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from .auth import get_current_user
from .db import get_db
from . import models


def _require_roles(*allowed_roles: str) -> Callable:
    def dependency(current_user: models.User = Depends(get_current_user)) -> models.User:
        if getattr(current_user, "is_active", True) is False:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return dependency


require_admin = _require_roles("admin")
require_photographer = _require_roles("photographer")
require_admin_or_photographer = _require_roles("admin", "photographer")


def require_client_album(
    album_code: str,
    db: Session = Depends(get_db),
) -> models.Album:
    """Treat possession of the album PIN/code as a read-only client capability."""
    album = db.query(models.Album).filter(models.Album.code == album_code).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found")
    if album.expires_at and datetime.utcnow() > album.expires_at:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Album has expired")
    return album


def require_album_owner(
    album_code: str,
    current_user: models.User = Depends(require_admin_or_photographer),
    db: Session = Depends(get_db),
) -> models.User:
    """Allow administrators globally and photographers only within their tenant."""
    if current_user.role == "admin":
        return current_user

    album = db.query(models.Album).filter(models.Album.code == album_code).first()
    if album and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Album belongs to another photographer")
    return current_user
