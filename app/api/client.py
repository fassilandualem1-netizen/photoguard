from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.redis import (
    get_album_version,
    increment_album_version,
    lock_album_submit,
    is_album_locked,
)
from app.models.album import Album, MediaItem
from app.schemas.album import AlbumDetailResponse
from app.schemas.client import (
    ClientVerifyRequest,
    ClientSyncResponse,
    ClientSubmitResponse,
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

@router.post("/submit/{pin}", response_model=ClientSubmitResponse, status_code=status.HTTP_200_OK)
def submit_album_selection(pin: str, db: Session = Depends(get_db)):
    """
    Atomic Single-Submit Lock.
    When any family member/collaborator clicks Submit, this executes Redis setnx.
    If lock is acquired, updates PostgreSQL Album.is_locked = True.
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
        album.is_locked = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Album was just locked by another family member."
        )

    # Persist lock in PostgreSQL
    album.is_locked = True
    db.commit()
    db.refresh(album)

    # Increment sync version so all polling clients immediately lock their UI
    increment_album_version(pin)

    return ClientSubmitResponse(
        message="Album selection submitted successfully. Gallery is now permanently locked.",
        pin=pin,
        is_locked=True
    )
