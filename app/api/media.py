import os
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.storage import (
    is_cloudinary_configured,
    upload_file_to_cloudinary,
    delete_file_from_cloudinary,
    upload_file_to_s3,
    generate_cdn_urls,
    save_file_locally,
    is_s3_configured,
)
from app.core.s3_cleanup import delete_file_from_s3
from app.core.redis import increment_album_version
from app.models.user import User, UserRole
from app.models.album import Album
from app.models.media import MediaItem
from app.schemas.media import MediaItemResponse
from app.services.image_processor import image_processor

logger = logging.getLogger("photoguard.media")

router = APIRouter(prefix="/api/v1/media", tags=["Media Storage & CDN"])

@router.post("/upload/{album_id}", response_model=MediaItemResponse, status_code=status.HTTP_201_CREATED)
async def upload_album_photo(
    album_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a photo with bulletproof Multi-Cloud S3 storage and automatic Local Storage Fallback.
    Enforces:
    1. Photographer Album ownership & Single-Submit Lock checks.
    2. SaaS Virtual Quota calculation (original size against user limit).
    3. Silent AI Compression & Face Recognition vector extraction.
    4. S3 Upload with resilient local disk fallback if credentials or S3 endpoint fail.
    5. Resilient database commits with automatic cleanup upon failure.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found."
        )

    # Permission check: must be owner photographer, authorized assistant, or admin
    is_owner = album.photographer_id == current_user.id
    is_assistant = current_user.role == UserRole.ASSISTANT and album.photographer_id == current_user.parent_owner_id
    if current_user.role != UserRole.ADMIN and not (is_owner or is_assistant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not own or have assistant access to this album."
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
    photographer = current_user if current_user.id == album.photographer_id else db.query(User).filter(User.id == album.photographer_id).first()
    
    if photographer and (photographer.storage_used + original_size > photographer.storage_quota_limit):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Storage quota exceeded. Please upgrade your photographer plan."
        )

    # Multi-Cloud Storage Upload (Primary: Cloudinary -> Secondary: S3 -> Fallback: Local Disk)
    high_res_url = None
    thumbnail_url = None
    storage_provider = "local"
    object_path = None

    # 1. Primary: Cloudinary Permanent Cloud Storage
    if is_cloudinary_configured():
        try:
            cloud_res = upload_file_to_cloudinary(
                file_bytes=file_bytes,
                filename=file.filename or "photo.jpg",
                folder=f"photoguard_vault/{album.pin}"
            )
            high_res_url = cloud_res["high_res_url"]
            thumbnail_url = cloud_res["thumbnail_url"]
            storage_provider = "cloudinary"
            logger.info(f"[Storage Success] Uploaded to Cloudinary: {high_res_url}")
        except Exception as cloud_exc:
            logger.warning(f"[Cloudinary Warning] Upload failed ({cloud_exc}). Proceeding to secondary storage.")

    # 2. Secondary: S3 / IDrive e2 Storage (if Cloudinary skipped or failed)
    if not high_res_url and is_s3_configured():
        try:
            await file.seek(0)
            object_path = upload_file_to_s3(file=file, filename=file.filename or "photo.jpg")
            cdn_urls = generate_cdn_urls(object_path=object_path)
            high_res_url = cdn_urls["high_res_url"]
            thumbnail_url = cdn_urls["thumbnail_url"]
            storage_provider = "s3"
            logger.info(f"[Storage Success] Uploaded to S3: {high_res_url}")
        except Exception as s3_exc:
            logger.warning(f"[Storage Warning] S3 upload failed ({s3_exc}). Activating local fallback.")

    # 3. Resilient Fallback: Local Disk Storage
    if not high_res_url:
        object_path = save_file_locally(file_bytes=file_bytes, filename=file.filename or "photo.jpg")
        cdn_urls = generate_cdn_urls(object_path=object_path)
        high_res_url = cdn_urls["high_res_url"]
        thumbnail_url = cdn_urls["thumbnail_url"]
        storage_provider = "local"
        logger.info(f"[Storage Info] Saved to local storage fallback: {high_res_url}")

    # Silent AI Compression & Face Recognition
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
        url=high_res_url,
        thumbnail_url=thumbnail_url,
        original_size=original_size,
        compressed_size=compressed_size,
        is_selected=False,
        client_notes=None,
        face_encodings=face_encodings if face_encodings else None
    )

    try:
        # Update virtual quota in database (increment only on upload)
        if photographer:
            photographer.storage_used += original_size

        db.add(media_item)
        db.commit()
        db.refresh(media_item)
    except SQLAlchemyError as exc:
        db.rollback()
        # Clean up uploaded file if DB commit fails
        if storage_provider == "cloudinary":
            delete_file_from_cloudinary(high_res_url)
        elif storage_provider == "s3" and object_path:
            try:
                delete_file_from_s3(object_path)
            except Exception as del_err:
                logger.warning(f"Failed to clean up S3 file after rollback: {del_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error saving media item: {str(exc)}"
        )

    # Inform collaborative mobile clients of new photos via Redis smart polling
    try:
        increment_album_version(album.pin)
    except Exception as redis_err:
        logger.warning(f"Redis increment_album_version notice: {redis_err}")

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

    is_owner = album.photographer_id == current_user.id
    is_assistant = current_user.role == UserRole.ASSISTANT and album.photographer_id == current_user.parent_owner_id
    if current_user.role != UserRole.ADMIN and not (is_owner or is_assistant):
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
    1. STRICT RBAC: Assistants cannot delete photos.
    2. Lifetime Bandwidth Quota: DO NOT decrement storage_used (preserves lifetime upload tracking).
    3. Physical storage cleanup: Deletes actual high-res object from S3 or local storage.
    4. Wrapped in strict try...except with db.rollback().
    """
    if current_user.role == UserRole.ASSISTANT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Assistants are not permitted to delete photos."
        )

    item = db.query(MediaItem).filter(MediaItem.id == media_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found.")

    album = db.query(Album).filter(Album.id == item.album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    item_url = item.url
    album_pin = album.pin

    try:
        # Note: We intentionally DO NOT subtract item.original_size from photographer.storage_used.
        # The storage_used field represents lifetime upload bandwidth quota to drive tier upgrades.

        db.delete(item)
        db.commit()

        # Storage Cleanup: delete from Cloudinary, local filesystem, or S3
        if item_url:
            if "res.cloudinary.com" in item_url:
                background_tasks.add_task(delete_file_from_cloudinary, item_url)
            elif item_url.startswith("/uploads/"):
                clean_filename = os.path.basename(item_url)
                local_filepath = os.path.join(os.getcwd(), "uploads", clean_filename)
                if os.path.exists(local_filepath):
                    try:
                        os.remove(local_filepath)
                    except Exception as del_f_err:
                        logger.warning(f"Could not remove local file {local_filepath}: {del_f_err}")
            else:
                background_tasks.add_task(delete_file_from_s3, item_url)

        # Increment sync version for active client apps
        try:
            increment_album_version(album_pin)
        except Exception as redis_err:
            logger.warning(f"Redis increment_album_version notice: {redis_err}")

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
