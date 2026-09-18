from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.redis import (
    get_album_version,
    increment_album_version,
    lock_album_submit,
    is_album_locked,
)
from app.core.telegram import notify_photographer_submission
from app.models.album import Album, MediaItem
from app.schemas.album import AlbumDetailResponse, MediaItemResponse
from app.schemas.client import (
    ClientVerifyRequest,
    ClientSyncResponse,
    ClientSubmitResponse,
    ClientMediaUpdateRequest,
)

router = APIRouter(prefix="/api/v1/client", tags=["Client Mobile API"])

@router.post("/verify", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def verify_client_pin(payload: ClientVerifyRequest, db: Session = Depends(get_db)):
    """
    Verifies the 6-digit PIN entered on the Client Mobile App (Kotlin/Jetpack Compose).
    Returns the album gallery and media items for RAM-only rendering.
    Returns HTTP 403 Forbidden if the album is already locked after submission.
    """
    pin = payload.pin.strip()
    album = db.query(Album).filter(Album.pin == pin).first()
    
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid 6-digit PIN. Album not found."
        )

    # Check if locked either in PostgreSQL or Upstash Redis
    if album.is_locked or is_album_locked(pin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This album has already been submitted and locked. Selections are final."
        )

    media_count = len(album.media_items)
    selected_count = sum(1 for item in album.media_items if item.is_selected)

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

@router.get("/sync/{pin}", response_model=ClientSyncResponse, status_code=status.HTTP_200_OK)
def sync_album_state(pin: str, db: Session = Depends(get_db)):
    """
    Smart Polling endpoint (Upstash Redis).
    Returns current version counter and lock status.
    Mobile app polls this lightweight integer endpoint to detect collaborative changes
    without requiring persistent WebSockets.
    """
    pin = pin.strip()
    album = db.query(Album).filter(Album.pin == pin).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album with specified PIN not found."
        )

    version = get_album_version(pin)
    locked = album.is_locked or is_album_locked(pin)

    return ClientSyncResponse(
        pin=pin,
        version=version,
        is_locked=locked
    )

@router.patch("/media/{media_id}", response_model=MediaItemResponse, status_code=status.HTTP_200_OK)
def update_client_media_selection(
    media_id: int,
    payload: ClientMediaUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Updates photo selection status (is_selected) and client feedback notes (client_notes).
    Enforces Single Submit Lock validation: If album is already locked, rejects update with 403.
    Bumps Redis version counter for instant collaborative sync among family members.
    """
    pin = payload.pin.strip()
    
    # Verify PIN access to the target album
    album = db.query(Album).filter(Album.pin == pin).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid album PIN."
        )

    # Check lock state
    if album.is_locked or is_album_locked(pin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Album is locked. Selections and notes cannot be altered."
        )

    media_item = db.query(MediaItem).filter(
        MediaItem.id == media_id,
        MediaItem.album_id == album.id
    ).first()

    if not media_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media item not found in this album."
        )

    try:
        if payload.is_selected is not None:
            media_item.is_selected = payload.is_selected
        if payload.client_notes is not None:
            media_item.client_notes = payload.client_notes.strip() if payload.client_notes else None

        db.commit()
        db.refresh(media_item)

        # Notify other devices polling the album
        increment_album_version(pin)

        return MediaItemResponse.model_validate(media_item)

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating media item: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error updating media item: {str(exc)}"
        )

@router.post("/submit/{pin}", response_model=ClientSubmitResponse, status_code=status.HTTP_200_OK)
def submit_album_selection(
    pin: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Atomic Single-Submit Lock.
    When any family member/collaborator clicks Submit, this executes Redis setnx.
    If lock is acquired, updates PostgreSQL Album.is_locked = True and album.submitted_at = func.now().
    Dispatches asynchronous Telegram alert to photographer if telegram_chat_id is configured.
    If already locked, returns HTTP 409 Conflict.
    """
    pin = pin.strip()
    album = db.query(Album).filter(Album.pin == pin).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album with specified PIN not found."
        )

    if album.is_locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Album has already been submitted and locked by another collaborator."
        )

    # Enforce atomic single-submit lock via Redis setnx
    lock_acquired = lock_album_submit(pin)
    if not lock_acquired:
        # Another request acquired the lock simultaneously
        try:
            album.is_locked = True
            album.submitted_at = func.now()
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Album was just locked by another family member."
        )

    # Persist lock and submission timestamp in PostgreSQL
    try:
        album.is_locked = True
        album.submitted_at = func.now()
        db.commit()
        db.refresh(album)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while submitting album: {str(exc)}"
        )

    # Increment sync version so all polling clients immediately lock their UI
    increment_album_version(pin)

    # Dispatch non-blocking Telegram alert to photographer
    if album.photographer and album.photographer.telegram_chat_id:
        background_tasks.add_task(
            notify_photographer_submission,
            album_title=album.title,
            client_name=album.client_name,
            chat_id=album.photographer.telegram_chat_id
        )

    return ClientSubmitResponse(
        message="Album selection submitted successfully. Gallery is now permanently locked.",
        pin=pin,
        is_locked=True
    )
