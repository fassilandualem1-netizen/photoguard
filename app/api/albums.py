import os
import logging
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.s3_cleanup import delete_file_from_s3
from app.models.user import User, UserRole
from app.models.album import Album, MediaItem, generate_album_pin
from app.schemas.album import (
    AlbumCreate,
    AlbumUpdate,
    AlbumExtendRequest,
    AlbumListItemResponse,
    AlbumDetailResponse,
    MediaItemResponse,
)

logger = logging.getLogger("photoguard.albums")

router = APIRouter(prefix="/api/v1/albums", tags=["Albums"])

def get_unique_pin(db: Session) -> str:
    """
    Generates a guaranteed unique 6-digit PIN for client authentication.
    """
    for _ in range(15):
        candidate = generate_album_pin()
        exists = db.query(Album.id).filter(Album.pin == candidate).first()
        if not exists:
            return candidate
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unable to allocate a unique PIN. Please retry."
    )

def check_is_expired(expires_at: Optional[datetime]) -> bool:
    """
    Helper function to calculate accurate UTC expiration state.
    """
    if expires_at is None:
        return False
    now_utc = datetime.now(timezone.utc)
    target_utc = expires_at if expires_at.tzinfo is not None else expires_at.replace(tzinfo=timezone.utc)
    return target_utc < now_utc

def serialize_media_item(m: MediaItem) -> MediaItemResponse:
    """
    Guarantees null-safe serialization for a media item.
    """
    return MediaItemResponse(
        id=m.id,
        album_id=m.album_id,
        filename=m.filename or "",
        url=m.url or "",
        thumbnail_url=m.thumbnail_url,
        original_size=int(m.original_size or 0),
        compressed_size=int(m.compressed_size or 0),
        is_selected=bool(m.is_selected or False),
        client_notes=m.client_notes,
        created_at=m.created_at,
    )

@router.post("", response_model=AlbumDetailResponse, status_code=status.HTTP_201_CREATED)
def create_album(
    payload: AlbumCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new Album belonging to the authenticated photographer.
    Auto-generates a unique 6-digit access PIN if not explicitly supplied.
    Sets optional initial expiration based on days or tier (7 days Basic / 30 days Studio).
    """
    if current_user.role not in [UserRole.PHOTOGRAPHER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only photographers and administrators can create albums."
        )

    # Validate or generate PIN
    if payload.pin:
        if len(payload.pin) != 6 or not payload.pin.isdigit():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PIN must be exactly 6 numeric digits."
            )
        existing_pin = db.query(Album.id).filter(Album.pin == payload.pin).first()
        if existing_pin:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The requested 6-digit PIN is already assigned to an active album."
            )
        assigned_pin = payload.pin
    else:
        assigned_pin = get_unique_pin(db)

    # Calculate expiration lifespan (default 7 days basic, 30 days studio, or user specified)
    now_utc = datetime.now(timezone.utc)
    if payload.expires_in_days:
        expires_at = now_utc + timedelta(days=payload.expires_in_days)
    else:
        default_days = 30 if getattr(current_user, "subscription_plan", "basic") == "studio" else 7
        expires_at = now_utc + timedelta(days=default_days)

    try:
        album = Album(
            title=payload.title,
            client_name=payload.client_name,
            pin=assigned_pin,
            photographer_id=current_user.id,
            allow_download=bool(payload.allow_download or False),
            is_locked=False,
            expires_at=expires_at,
            submitted_at=None
        )
        
        db.add(album)
        db.commit()
        db.refresh(album)

        return AlbumDetailResponse(
            id=album.id,
            title=album.title or "Untitled Album",
            client_name=album.client_name or "Unknown Client",
            pin=album.pin or "",
            photographer_id=album.photographer_id,
            is_locked=bool(album.is_locked or False),
            allow_download=bool(album.allow_download or False),
            created_at=album.created_at,
            expires_at=album.expires_at,
            is_expired=check_is_expired(album.expires_at),
            submitted_at=album.submitted_at,
            media_count=0,
            selected_count=0,
            media_items=[]
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"[Albums API] Database error creating album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error creating album: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Unexpected error creating album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error creating album: {str(exc)}"
        )

@router.get("", response_model=List[AlbumListItemResponse], status_code=status.HTTP_200_OK)
def list_albums(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists all albums for the logged-in photographer.
    Administrators receive all albums across the platform.
    Calculates exact expiration status for each album.
    Robustly sanitizes all DB columns, converting None values to valid types.
    """
    try:
        if current_user.role == UserRole.ADMIN:
            albums = db.query(Album).order_by(Album.created_at.desc()).all()
        else:
            albums = db.query(Album).filter(Album.photographer_id == current_user.id).order_by(Album.created_at.desc()).all()

        result = []
        for alb in albums:
            media_items = alb.media_items or []
            media_count = len(media_items)
            selected_count = sum(1 for m in media_items if bool(m.is_selected or False))
            result.append(
                AlbumListItemResponse(
                    id=alb.id,
                    title=alb.title or "Untitled Album",
                    client_name=alb.client_name or "Unknown Client",
                    pin=alb.pin or "",
                    photographer_id=alb.photographer_id,
                    is_locked=bool(alb.is_locked or False),
                    allow_download=bool(alb.allow_download or False),
                    created_at=alb.created_at,
                    expires_at=alb.expires_at,
                    is_expired=check_is_expired(alb.expires_at),
                    submitted_at=alb.submitted_at,
                    media_count=media_count,
                    selected_count=selected_count
                )
            )
        return result
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Error in list_albums: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve albums: {str(exc)}"
        )

@router.get("/{album_id}", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def get_album(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches full album details including associated media items.
    Returns the exact expiration status (is_expired).
    Enforces ownership permissions (photographer must own the album unless admin).
    Guarantees null-safe serialization.
    """
    try:
        album = db.query(Album).filter(Album.id == album_id).first()
        if not album:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

        if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

        media_items = album.media_items or []
        media_count = len(media_items)
        selected_count = sum(1 for m in media_items if bool(m.is_selected or False))
        is_expired = check_is_expired(album.expires_at)

        safe_media_items = [serialize_media_item(m) for m in media_items]

        return AlbumDetailResponse(
            id=album.id,
            title=album.title or "Untitled Album",
            client_name=album.client_name or "Unknown Client",
            pin=album.pin or "",
            photographer_id=album.photographer_id,
            is_locked=bool(album.is_locked or False),
            allow_download=bool(album.allow_download or False),
            created_at=album.created_at,
            expires_at=album.expires_at,
            is_expired=is_expired,
            submitted_at=album.submitted_at,
            media_count=media_count,
            selected_count=selected_count,
            media_items=safe_media_items
        )
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Error in get_album: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve album details: {str(exc)}"
        )

@router.put("/{album_id}/extend", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def extend_album_expiration(
    album_id: int,
    payload: AlbumExtendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows photographers to extend expires_at by a given number of days.
    If the album was already expired, resets expiration from current UTC time plus requested days.
    If the album was locked due to expiration, unlocks it if not already submitted.
    Wrapped in strict try...except with db.rollback().
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    now_utc = datetime.now(timezone.utc)

    try:
        # Base calculation: from current expiration or from now if already expired or null
        if album.expires_at is not None:
            current_exp_utc = (
                album.expires_at if album.expires_at.tzinfo is not None
                else album.expires_at.replace(tzinfo=timezone.utc)
            )
            base_time = max(current_exp_utc, now_utc)
        else:
            base_time = now_utc

        new_expiration = base_time + timedelta(days=payload.days)
        album.expires_at = new_expiration

        # If it was locked only due to expiration (and not finalized via client submit), unlock it
        if bool(album.is_locked or False) and album.submitted_at is None:
            album.is_locked = False

        db.commit()
        db.refresh(album)

        media_items = album.media_items or []
        media_count = len(media_items)
        selected_count = sum(1 for m in media_items if bool(m.is_selected or False))
        safe_media_items = [serialize_media_item(m) for m in media_items]

        return AlbumDetailResponse(
            id=album.id,
            title=album.title or "Untitled Album",
            client_name=album.client_name or "Unknown Client",
            pin=album.pin or "",
            photographer_id=album.photographer_id,
            is_locked=bool(album.is_locked or False),
            allow_download=bool(album.allow_download or False),
            created_at=album.created_at,
            expires_at=album.expires_at,
            is_expired=check_is_expired(album.expires_at),
            submitted_at=album.submitted_at,
            media_count=media_count,
            selected_count=selected_count,
            media_items=safe_media_items
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"[Albums API] Database error extending album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error extending album expiration: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Unexpected error extending album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error extending album expiration: {str(exc)}"
        )

@router.get("/{album_id}/export", response_model=List[MediaItemResponse], status_code=status.HTTP_200_OK)
def export_album_selections(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports final client photo selections (is_selected = True) for Lightroom/Photoshop workflows.
    Enforces strict ownership access control.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    media_items = album.media_items or []
    selected_items = [serialize_media_item(item) for item in media_items if bool(item.is_selected or False)]
    return selected_items

@router.patch("/{album_id}", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def update_album(
    album_id: int,
    payload: AlbumUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates album metadata, lock status, or download permissions.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    try:
        if payload.title is not None:
            album.title = payload.title
        if payload.client_name is not None:
            album.client_name = payload.client_name
        if payload.is_locked is not None:
            album.is_locked = bool(payload.is_locked)
        if payload.allow_download is not None:
            album.allow_download = bool(payload.allow_download)

        db.commit()
        db.refresh(album)

        media_items = album.media_items or []
        media_count = len(media_items)
        selected_count = sum(1 for m in media_items if bool(m.is_selected or False))
        safe_media_items = [serialize_media_item(m) for m in media_items]

        return AlbumDetailResponse(
            id=album.id,
            title=album.title or "Untitled Album",
            client_name=album.client_name or "Unknown Client",
            pin=album.pin or "",
            photographer_id=album.photographer_id,
            is_locked=bool(album.is_locked or False),
            allow_download=bool(album.allow_download or False),
            created_at=album.created_at,
            expires_at=album.expires_at,
            is_expired=check_is_expired(album.expires_at),
            submitted_at=album.submitted_at,
            media_count=media_count,
            selected_count=selected_count,
            media_items=safe_media_items
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"[Albums API] Database error updating album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating album: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Unexpected error updating album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error updating album: {str(exc)}"
        )

@router.delete("/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_album(
    album_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes an album and cascades removal to all its media items:
    1. Lifetime Bandwidth Quota: DO NOT decrement storage_used (preserves lifetime upload tracking).
    2. Physical storage cleanup: Deletes actual media files from S3 or local storage.
    3. Cascades removal of album and its media records from database.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    try:
        # Collect media files for physical storage cleanup prior to DB cascade
        media_items = album.media_items or []
        for item in media_items:
            item_url = item.url
            if item_url and item_url.startswith("/uploads/"):
                clean_filename = os.path.basename(item_url)
                local_filepath = os.path.join(os.getcwd(), "uploads", clean_filename)
                if os.path.exists(local_filepath):
                    try:
                        os.remove(local_filepath)
                    except Exception as del_f_err:
                        logger.warning(f"Could not remove local file {local_filepath}: {del_f_err}")
            elif item_url:
                background_tasks.add_task(delete_file_from_s3, item_url)

        # Note: Do NOT subtract from user's storage_used. It tracks lifetime upload bandwidth!
        db.delete(album)
        db.commit()
        return None
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"[Albums API] Database error deleting album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error deleting album: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Unexpected error deleting album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error deleting album: {str(exc)}"
        )
