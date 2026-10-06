import os
from PIL import Image
import io
import uuid
from datetime import datetime, timezone
import logging
import tempfile
import shutil
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
    is_s3_configured,
)
from app.core.s3_cleanup import delete_file_from_s3
from app.core.redis import increment_album_version, check_generic_rate_limit
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
    # RATE-01: 30 signatures per user per minute
    is_limited, retry_after = check_generic_rate_limit(f"rate:signature:user:{current_user.id}", 30, 60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Too many signature requests. Try again in {retry_after}s.")
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

    # API-02: Pre-signature SaaS Virtual Quota Check
    effective_owner_id = current_user.effective_owner_id or current_user.id
    owner = db.query(User).filter(User.id == effective_owner_id).first()
    if owner and ((owner.storage_used or 0) >= owner.storage_quota_limit):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Storage quota exceeded for this studio account. Cannot generate upload signature."
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
    # RATE-01: 120 saves per user per minute
    is_limited, retry_after = check_generic_rate_limit(f"rate:saveurl:user:{current_user.id}", 120, 60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Too many save URL requests. Try again in {retry_after}s.")
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

    effective_owner_id = current_user.effective_owner_id
    owner = db.query(User).filter(User.id == effective_owner_id).first() or current_user

    high_res_url = payload.url

    # PG-16: URL Trust - strictly verify the domain belongs to our configured providers
    valid_domains = ["res.cloudinary.com", "s3.amazonaws.com", "r2.cloudflarestorage.com", "idrivee2-e2dest.com"]
    is_valid_url = any(domain in high_res_url for domain in valid_domains)
    if not is_valid_url:
        raise HTTPException(status_code=400, detail="Invalid storage URL provider.")

    original_size = payload.original_size or 0
    # PG-15: Quota Integrity - strictly validate maximum spoofable size for direct uploads
    MAX_DIRECT_UPLOAD_SIZE = 100 * 1024 * 1024 # 100MB
    if original_size > MAX_DIRECT_UPLOAD_SIZE or original_size < 0:
        raise HTTPException(status_code=400, detail="Invalid original_size reported.")
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
            owner.storage_used = (owner.storage_used or 0) + original_size
        db.add(media_item)
        db.commit()
        db.refresh(media_item)
    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error saving photo: {req_id}"
        )

    try:
        increment_album_version(album.pin)
    except Exception as redis_err:
        logger.warning(f"Redis increment_album_version notice: {redis_err}")

    return media_item


@router.post("/upload/{album_id}", response_model=MediaItemResponse, status_code=status.HTTP_201_CREATED)
def upload_album_photo(
    album_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve album without locking the row for every concurrent upload
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found.")

    # Check Expiration
    now_utc = datetime.now(timezone.utc)
    if album.expires_at:
        album_expires_utc = album.expires_at if album.expires_at.tzinfo else album.expires_at.replace(tzinfo=timezone.utc)
        if album_expires_utc <= now_utc:
            raise HTTPException(status_code=403, detail="Album has expired.")

    # Permission check
    if not check_media_album_access(album, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied.")

    # Cannot upload to an already submitted album
    if album.is_locked:
        raise HTTPException(status_code=403, detail="Album is locked.")

    # Basic File Validation
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Unsupported image format.")
    
    file_bytes = file.file.read()
    original_size = len(file_bytes)
    
    if original_size == 0 or original_size > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Invalid file size.")

    # Virtual Quota Check
    effective_owner_id = current_user.effective_owner_id or current_user.id
    owner = db.query(User).filter(User.id == effective_owner_id).first()
        
    if owner and ((owner.storage_used or 0) + original_size > owner.storage_quota_limit):
        raise HTTPException(status_code=402, detail="Storage quota exceeded for this studio account.")

    # Cloud Upload
    high_res_url = None
    thumbnail_url = None
    object_path = None
    storage_provider = "local"

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
        except Exception as cloud_exc:
            logger.warning(f"Cloudinary upload failed: {cloud_exc}")

    if not high_res_url and is_s3_configured():
        try:
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
            
            with open(tmp_path, "rb") as f_s3:
                file.file = f_s3
                object_path = upload_file_to_s3(file=file, filename=file.filename or "photo.jpg")
            
            cdn_urls = generate_cdn_urls(object_path=object_path)
            high_res_url = cdn_urls["high_res_url"]
            thumbnail_url = cdn_urls["thumbnail_url"]
            storage_provider = "s3"
            os.remove(tmp_path)
        except Exception as s3_exc:
            logger.warning(f"S3 upload failed: {s3_exc}")

    if not high_res_url:
        raise HTTPException(status_code=502, detail="Cloud Storage Upload Failed")

    # DB Record
    media_item = MediaItem(
        album_id=album.id,
        filename=file.filename or "photo.jpg",
        url=high_res_url,
        thumbnail_url=thumbnail_url,
        original_size=original_size,
        compressed_size=int(original_size * 0.15),
        is_selected=False,
        client_notes=None,
    )

    try:
        if owner:
            owner.storage_used = (owner.storage_used or 0) + original_size

        db.add(media_item)
        db.commit()
        db.refresh(media_item)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"DB Error: {exc}")
        raise HTTPException(status_code=500, detail="Database save failed.")

    try:
        increment_album_version(album.pin)
    except Exception:
        pass

    # CLD-01 / S3-01: Generate signed URLs for authenticated assets before returning to photographer dashboard
    from app.core.storage import generate_signed_clean_url, generate_s3_presigned_url
    items_out = []
    for item in album.media_items:
        high_res = item.url
        thumb = item.thumbnail_url

        if high_res and "res.cloudinary.com" in high_res:
            high_res = generate_signed_clean_url(high_res) or high_res
        elif high_res and high_res.startswith("s3://"):
            high_res = generate_s3_presigned_url(high_res) or high_res
            
        if thumb and "res.cloudinary.com" in thumb:
            thumb = generate_signed_clean_url(thumb) or thumb
        elif thumb and thumb.startswith("s3://"):
            thumb = generate_s3_presigned_url(thumb) or thumb
            
        item.url = high_res
        item.thumbnail_url = thumb
        items_out.append(item)

    return items_out

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
            owner = db.query(User).filter(User.id == (album_creator.effective_owner_id or album_creator.id)).with_for_update().first() or album_creator
        elif current_user:
            owner = db.query(User).filter(User.id == (current_user.effective_owner_id or current_user.id)).with_for_update().first() or current_user

        if owner and item_size > 0:
            owner.storage_used = max(0, (owner.storage_used or 0) - item_size)
            logger.info(f"[Media API] Reclaimed {item_size} bytes for owner {owner.email}. New storage_used: {owner.storage_used}")

        # PG-19: Consistency. Delete from cloud FIRST, then DB.
        urls_to_delete = set()
        if item_url:
            urls_to_delete.add(item_url)
        if item_thumb:
            urls_to_delete.add(item_thumb)

        for u in urls_to_delete:
            success = destroy_media_asset(u)
            if not success:
                logger.error(f"Failed to delete cloud asset {u}. Aborting DB deletion.")
                raise HTTPException(status_code=500, detail="Failed to delete file from cloud storage. Please try again.")

        db.delete(item)
        db.commit()

        # Increment sync version for active client apps
        try:
            increment_album_version(album_pin)
        except Exception as redis_err:
            logger.warning(f"Redis increment_album_version notice: {redis_err}")

        return None
    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error deleting media item: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error deleting media item: {req_id}"
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
