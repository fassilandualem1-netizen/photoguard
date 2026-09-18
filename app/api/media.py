from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.storage import upload_file_to_s3, generate_cdn_urls
from app.core.redis import increment_album_version
from app.models.user import User, UserRole
from app.models.album import Album, MediaItem
from app.schemas.album import MediaItemResponse

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
    Enforces Photographer Album ownership, Single-Submit Lock checks, and SaaS Virtual Quota calculation.
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

    # Measure raw original file size
    file.file.seek(0, 2)
    original_size = file.file.tell()
    file.file.seek(0)

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

    # Upload raw image to IDrive e2 S3
    try:
        object_path = upload_file_to_s3(file=file, filename=file.filename or "photo.jpg")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multi-Cloud storage upload failed: {str(exc)}"
        )

    # Generate edge CDN URLs: Cloudflare (high-res) & ImageKit (WebP preview)
    cdn_urls = generate_cdn_urls(object_path=object_path)

    # SaaS Magic: Actual cloud size is ~15% of original due to background AI/WebP compression
    compressed_size = int(original_size * 0.15)

    media_item = MediaItem(
        album_id=album.id,
        filename=file.filename or "photo.jpg",
        url=cdn_urls["high_res_url"],
        thumbnail_url=cdn_urls["thumbnail_url"],
        original_size=original_size,
        compressed_size=compressed_size,
        is_selected=False,
        client_notes=None
    )

    # Update virtual quota
    if photographer:
        photographer.storage_used += original_size

    db.add(media_item)
    db.commit()
    db.refresh(media_item)

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes a media item and credits back the photographer's virtual storage quota.
    """
    item = db.query(MediaItem).filter(MediaItem.id == media_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found.")

    album = db.query(Album).filter(Album.id == item.album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent album not found.")

    if current_user.role != UserRole.ADMIN and album.photographer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Reclaim virtual storage quota
    photographer = db.query(User).filter(User.id == album.photographer_id).first()
    if photographer and photographer.storage_used >= item.original_size:
        photographer.storage_used -= item.original_size

    db.delete(item)
    db.commit()

    # Increment sync version
    increment_album_version(album.pin)
    return None
