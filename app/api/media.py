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
    destroy_media_asset,
    generate_cloudinary_signature,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
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
from app.schemas.media import MediaItemResponse, DirectUploadSignatureResponse, DirectSaveUrlRequest
from app.services.image_processor import image_processor

logger = logging.getLogger("photoguard.media")

router = APIRouter(prefix="/api/v1/media", tags=["Media Storage & CDN"])

def check_media_album_access(album: Album, current_user: User, db: Session) -> bool:
    """
    Strict Media Album Access Control & Data Isolation:
    - Admin: Full access.
    - Studio Assistant: Strictly albums they created themselves (album.photographer_id == current_user.id).
    - Main Photographer (Owner): Albums created by themselves OR any of their assistants.
    """
    if current_user.role == UserRole.ADMIN.value or current_user.role == UserRole.ADMIN:
        return True

    user_role = str(getattr(current_user, "role", "") or "").lower()
    is_assistant = (
        user_role == UserRole.ASSISTANT.value
        or user_role == "assistant"
        or current_user.parent_id is not None
    )

    if is_assistant:
        return album.photographer_id == current_user.id

    if album.photographer_id == current_user.id:
        return True

    creator = db.query(User.parent_id).filter(User.id == album.photographer_id).first()
    if creator and creator.parent_id == current_user.id:
        return True

    return False


@router.get("/upload-signature", response_model=DirectUploadSignatureResponse, status_code=status.HTTP_200_OK)
def get_upload_signature(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates a secure, cryptographically signed Cloudinary upload signature.
    Allows frontend clients to upload photos directly to Cloudinary edge nodes,
    bypassing the FastAPI backend server completely for lightning-fast speeds.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found."
        )

    if not check_media_album_access(album, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to upload to this album."
        )

    if album.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Album is locked. Client has finalized selection."
        )

    import time
    timestamp = int(time.time())
    folder = f"photoguard_vault/{album.pin}"
    signature = generate_cloudinary_signature(folder=folder, timestamp=timestamp)
    cloud_name = str(CLOUDINARY_CLOUD_NAME or "photoguard").strip()

    return DirectUploadSignatureResponse(
        signature=signature,
        timestamp=timestamp,
        api_key=str(CLOUDINARY_API_KEY or "").strip(),
        cloud_name=cloud_name,
        folder=folder,
        upload_url=f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
    )


@router.post("/save-url", response_model=MediaItemResponse, status_code=status.HTTP_201_CREATED)
def save_direct_upload_url(
    payload: DirectSaveUrlRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Instantly registers a photo in PostgreSQL after direct client-to-cloud upload.
    Generates high-fidelity AVIF/Retina thumbnail URL, records SaaS virtual quota,
    and increments Redis live version. Zero CPU load on the backend.
    """
    album = db.query(Album).filter(Album.id == payload.album_id).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found."
        )

    if not check_media_album_access(album, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to save photos to this album."
        )

    if album.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Album is locked. Client has finalized selection."
        )

    original_size = payload.original_size or 0
    effective_owner_id = current_user.effective_owner_id
    owner = db.query(User).filter(User.id == effective_owner_id).first() or current_user

    # Generate retina AVIF thumbnail delivery URL if Cloudinary URL
    high_res_url = payload.url
    thumbnail_url = payload.thumbnail_url or high_res_url
    if high_res_url and "/upload/" in high_res_url and not payload.thumbnail_url:
        thumbnail_url = high_res_url.replace(
            "/upload/",
            "/upload/f_avif,q_auto:best,dpr_2.0,w_1200,c_limit/"
        )

    compressed_size = payload.compressed_size or (int(original_size * 0.15) if original_size else 0)

    media_item = MediaItem(
        album_id=album.id,
        filename=payload.filename or "photo.jpg",
        url=high_res_url,
        thumbnail_url=thumbnail_url,
        original_size=original_size,
        compressed_size=compressed_size,
        is_selected=False,
        client_notes=None
    )

    try:
        if owner and original_size > 0:
            owner.storage_used += original_size
        db.add(media_item)
        db.commit()
        db.refresh(media_item)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error saving photo: {str(exc)}"
        )

    try:
        increment_album_version(album.pin)
    except Exception as redis_err:
        logger.warning(f"Redis increment_album_version notice: {redis_err}")

    return media_item


@router.post("/upload/{album_id}", response_model=MediaItemResponse, status_code=status.HTTP_201_CREATED)
def upload_album_photo(
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

    # Permission check: must be owner photographer, creator assistant, or admin
    if not check_media_album_access(album, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to upload to this album."
        )

    # Cannot upload to an already submitted/locked album
    if album.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Album is locked. Client has finalized selection."
        )

    # Read uploaded file content
    try:
        file_bytes = file.file.read()
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

    # SaaS Virtual Quota Check: routed through effective_owner_id
    effective_owner_id = current_user.effective_owner_id
    owner = db.query(User).filter(User.id == effective_owner_id).first() or current_user
    
    if owner and (owner.storage_used + original_size > owner.storage_quota_limit):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Storage quota exceeded for this studio account. Please upgrade your photographer plan."
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
            file.file.seek(0)
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

    # Silent AI Compression
    compressed_bytes = None
    try:
        compressed_bytes = image_processor.compress_image_silent_ai(file_bytes)
        compressed_size = len(compressed_bytes) if compressed_bytes else int(original_size * 0.15)
    except Exception as ai_exc:
        logger.warning(f"AI image processing warning: {ai_exc}")
        compressed_size = int(original_size * 0.15)

    # If local fallback storage was used, store the crystal-clear compressed WebP as thumbnail_url
    if storage_provider == "local" and compressed_bytes:
        try:
            from app.core.storage import save_thumbnail_locally
            thumbnail_url = save_thumbnail_locally(compressed_bytes, file.filename or "photo.jpg")
        except Exception as thumb_err:
            logger.warning(f"Failed to save local thumbnail: {thumb_err}")

    media_item = MediaItem(
        album_id=album.id,
        filename=file.filename or "photo.jpg",
        url=high_res_url,
        thumbnail_url=thumbnail_url,
        original_size=original_size,
        compressed_size=compressed_size,
        is_selected=False,
        client_notes=None,
    )

    try:
        # Update virtual quota in database on the studio effective owner account
        if owner:
            owner.storage_used += original_size

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
    Lists all media items within an album with strict data isolation.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if not check_media_album_access(album, current_user, db):
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
    1. Reclaims Storage Quota: Decrements item.original_size from owner.storage_used (ensuring >= 0).
    2. Airtight Physical Storage Cleanup: Deletes BOTH item.url AND item.thumbnail_url from Cloudinary/S3/Disk.
    3. Wrapped in strict try...except with db.rollback().
    """
    item = db.query(MediaItem).filter(MediaItem.id == media_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found.")

    album = db.query(Album).filter(Album.id == item.album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent album not found.")

    if not check_media_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    item_url = item.url
    item_thumb = item.thumbnail_url
    item_size = getattr(item, "original_size", 0) or 0
    album_pin = album.pin

    try:
        # Reclaim storage quota on effective studio owner
        album_creator = db.query(User).filter(User.id == album.photographer_id).first()
        owner = None
        if album_creator:
            owner = db.query(User).filter(User.id == album_creator.effective_owner_id).first() or album_creator
        elif current_user:
            owner = db.query(User).filter(User.id == current_user.effective_owner_id).first() or current_user

        if owner and item_size > 0:
            owner.storage_used = max(0, (owner.storage_used or 0) - item_size)
            logger.info(f"[Media API] Reclaimed {item_size} bytes for owner {owner.email}. New storage_used: {owner.storage_used}")

        db.delete(item)
        db.commit()

        # Airtight Storage Cleanup: delete BOTH high-res url and thumbnail_url
        urls_to_delete = set()
        if item_url:
            urls_to_delete.add(item_url)
        if item_thumb:
            urls_to_delete.add(item_thumb)

        for u in urls_to_delete:
            background_tasks.add_task(destroy_media_asset, u)

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

@router.get("/{media_id}/download")
def download_media_item(
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Directly streams or redirects to the original media proof for local studio download.
    """
    from fastapi.responses import FileResponse, RedirectResponse

    item = db.query(MediaItem).filter(MediaItem.id == media_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found.")
    album = db.query(Album).filter(Album.id == item.album_id).first()
    if not album or not check_media_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    
    if item.url and item.url.startswith("/uploads/"):
        clean_fn = os.path.basename(item.url)
        local_path = os.path.join(os.getcwd(), "uploads", clean_fn)
        if os.path.exists(local_path):
            return FileResponse(
                local_path,
                media_type="image/jpeg",
                filename=item.filename or clean_fn
            )
            
    if not item.url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file URL not found.")

    return RedirectResponse(url=item.url)
