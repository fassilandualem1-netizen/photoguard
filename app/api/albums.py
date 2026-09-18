from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.album import Album, MediaItem, generate_album_pin
from app.schemas.album import (
    AlbumCreate,
    AlbumUpdate,
    AlbumListItemResponse,
    AlbumDetailResponse,
    MediaItemResponse,
)

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

@router.post("", response_model=AlbumDetailResponse, status_code=status.HTTP_201_CREATED)
def create_album(
    payload: AlbumCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new Album belonging to the authenticated photographer.
    Auto-generates a unique 6-digit access PIN if not explicitly supplied.
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

    try:
        album = Album(
            title=payload.title,
            client_name=payload.client_name,
            pin=assigned_pin,
            photographer_id=current_user.id,
            allow_download=payload.allow_download,
            is_locked=False,
            submitted_at=None
        )
        
        db.add(album)
        db.commit()
        db.refresh(album)

        return AlbumDetailResponse(
            id=album.id,
            title=album.title,
            client_name=album.client_name,
            pin=album.pin,
            photographer_id=album.photographer_id,
            is_locked=album.is_locked,
            allow_download=album.allow_download,
            created_at=album.created_at,
            expires_at=album.expires_at,
            submitted_at=album.submitted_at,
            media_count=0,
            selected_count=0,
            media_items=[]
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error creating album: {str(exc)}"
        )

@router.get("", response_model=List[AlbumListItemResponse], status_code=status.HTTP_200_OK)
def list_albums(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists all albums for the logged-in photographer.
    Administrators receive all albums across the platform.
    """
    if current_user.role == UserRole.ADMIN:
        albums = db.query(Album).order_by(Album.created_at.desc()).all()
    else:
        albums = db.query(Album).filter(Album.photographer_id == current_user.id).order_by(Album.created_at.desc()).all()

    result = []
    for alb in albums:
        media_count = len(alb.media_items)
        selected_count = sum(1 for m in alb.media_items if m.is_selected)
        result.append(
            AlbumListItemResponse(
                id=alb.id,
                title=alb.title,
                client_name=alb.client_name,
                pin=alb.pin,
                photographer_id=alb.photographer_id,
                is_locked=alb.is_locked,
                allow_download=alb.allow_download,
                created_at=alb.created_at,
                expires_at=alb.expires_at,
                submitted_at=alb.submitted_at,
                media_count=media_count,
                selected_count=selected_count
            )
        )
    return result

@router.get("/{album_id}", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def get_album(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches full album details including associated media items.
    Enforces ownership permissions (photographer must own the album unless admin).
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    media_count = len(album.media_items)
    selected_count = sum(1 for m in album.media_items if m.is_selected)

    return AlbumDetailResponse(
        id=album.id,
        title=album.title,
        client_name=album.client_name,
        pin=album.pin,
        photographer_id=album.photographer_id,
        is_locked=album.is_locked,
        allow_download=album.allow_download,
        created_at=album.created_at,
        expires_at=album.expires_at,
        submitted_at=album.submitted_at,
        media_count=media_count,
        selected_count=selected_count,
        media_items=album.media_items
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

    selected_items = [item for item in album.media_items if item.is_selected]
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
            album.is_locked = payload.is_locked
        if payload.allow_download is not None:
            album.allow_download = payload.allow_download

        db.commit()
        db.refresh(album)

        media_count = len(album.media_items)
        selected_count = sum(1 for m in album.media_items if m.is_selected)

        return AlbumDetailResponse(
            id=album.id,
            title=album.title,
            client_name=album.client_name,
            pin=album.pin,
            photographer_id=album.photographer_id,
            is_locked=album.is_locked,
            allow_download=album.allow_download,
            created_at=album.created_at,
            expires_at=album.expires_at,
            submitted_at=album.submitted_at,
            media_count=media_count,
            selected_count=selected_count,
            media_items=album.media_items
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating album: {str(exc)}"
        )

@router.delete("/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_album(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes an album and cascades removal to all its media items.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    try:
        db.delete(album)
        db.commit()
        return None
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error deleting album: {str(exc)}"
        )
