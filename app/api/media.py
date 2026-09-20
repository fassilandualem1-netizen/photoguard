import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.storage import upload_file_to_s3, generate_cdn_urls
from app.core.s3_cleanup import delete_file_from_s3
from app.core.redis import increment_album_version
from app.models.user import User, UserRole
from app.models.album import Album
from app.models.media import MediaItem
from app.schemas.album import MediaItemResponse
from app.services.image_processor import image_processor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/media", tags=["Media Storage & CDN"])

@router.post("/upload/{album_id}", response_model=MediaItemResponse, status_code=status.HTTP_201_CREATED)
async def upload_album_photo(
    album_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a photo to IDrive e2 S3 origin storage and distributes via Cloudflare & ImageKit CDNs.
    Enforces:
    1. Photographer Album ownership & Single-Submit Lock checks.
    2. SaaS Virtual Quota calculation (original size against user limit).
    3. Silent AI Compression (Lanczos resampling & WebP optimization) & Face Recognition vector extraction.
    4. Resilient database commits with automatic cleanup upon failure.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found."
        )

    # Permission check: must be owner photographer or admin
    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not own this album."
        )

    # Cannot upload to an already submitted/locked album
    if album.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Album is locked. Client has finalized selection."
        )

    # Read uploaded file content
    try:
        file_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded image: {str(exc)}"
        )

    original_size = len(file_bytes)
    if original_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # SaaS Virtual Quota Check:
    # Display the full RAW/JPEG size against the photographer's plan quota
    photographer = current_user if current_user.id == album.photographer_id else db.query(User).filter(User.id == album.photographer_id).first()
    
    if photographer and (photographer.storage_used + original_size > photographer.storage_quota_limit):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Storage quota exceeded. Please upgrade your photographer plan."
        )

    # Reset file pointer for S3 upload streaming
    await file.seek(0)

    # Upload raw image to IDrive e2 S3 origin
    try:
        object_path = upload_file_to_s3(file=file, filename=file.filename or "photo.jpg")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multi-Cloud storage upload failed: {str(exc)}"
        )

    # Generate edge CDN URLs: Cloudflare (high-res) & ImageKit (WebP preview)
    cdn_urls = generate_cdn_urls(object_path=object_path)

    # Phase 7.9 AI Engine Execution:
    # 1. Silent AI Compression: estimate/calculate real cloud storage
    # 2. Extract 128-dimensional face recognition feature vectors
    face_encodings = []
    try:
        compressed_bytes = image_processor.compress_image_silent_ai(file_bytes)
        compressed_size = len(compressed_bytes) if compressed_bytes else int(original_size * 0.15)
        face_encodings = image_processor.extract_face_encodings(file_bytes)
    except Exception as ai_exc:
        logger.warning(f"AI image processing warning: {ai_exc}")
        compressed_size = int(original_size * 0.15)
        face_encodings = []

    media_item = MediaItem(
        album_id=album.id,
        filename=file.filename or "photo.jpg",
        url=cdn_urls["high_res_url"],
        thumbnail_url=cdn_urls["thumbnail_url"],
        original_size=original_size,
        compressed_size=compressed_size,
        is_selected=False,
        client_notes=None,
        face_encodings=face_encodings if face_encodings else None
    )

    try:
        # Update virtual quota in database
        if photographer:
            photographer.storage_used += original_size

        db.add(media_item)
        db.commit()
        db.refresh(media_item)
    except SQLAlchemyError as exc:
        db.rollback()
        # Clean up uploaded file if DB commit fails
        delete_file_from_s3(object_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error saving media item: {str(exc)}"
        )

    # Inform collaborative mobile clients of new photos via Redis smart polling
    increment_album_version(album.pin)

    return MediaItemResponse.model_validate(media_item)

@router.get("/album/{album_id}", response_model=List[MediaItemResponse], status_code=status.HTTP_200_OK)
def list_album_media(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists all media items within an album for the owner photographer or admin.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return album.media_items

@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media_item(
    media_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes a media item:
    1. Reclaims virtual storage quota (subtracts item.original_size from photographer.storage_used).
    2. Physical storage cleanup: Deletes actual high-res object from IDrive e2 S3 bucket via boto3.
    3. Wrapped in strict try...except with db.rollback().
    """
    item = db.query(MediaItem).filter(MediaItem.id == media_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found.")

    album = db.query(Album).filter(Album.id == item.album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    item_url = item.url
    item_original_size = item.original_size or 0
    album_pin = album.pin
    photographer = db.query(User).filter(User.id == album.photographer_id).first()

    try:
        # Reclaim virtual storage quota
        if photographer and photographer.storage_used >= item_original_size:
            photographer.storage_used -= item_original_size
        elif photographer:
            photographer.storage_used = max(0, photographer.storage_used - item_original_size)

        db.delete(item)
        db.commit()

        # Physical Cloud Storage Cleanup: delete actual file from IDrive e2 S3 bucket
        background_tasks.add_task(delete_file_from_s3, item_url)

        # Increment sync version for active client apps
        increment_album_version(album_pin)

        return None

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error deleting media item: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error deleting media item: {str(exc)}"
        )
