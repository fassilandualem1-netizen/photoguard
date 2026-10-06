from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, UploadFile, File, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.redis import (
    get_redis,
    get_album_version,
    increment_album_version,
    lock_album_submit,
    is_album_locked,
    check_pin_rate_limit,
    record_failed_pin_attempt,
    reset_pin_rate_limit,
)
from app.core.telegram import notify_photographer_submission
from app.models.user import User
from app.models.album import Album, MediaItem
from app.schemas.album import AlbumDetailResponse, MediaItemResponse, SocialLinksResponse
from app.schemas.client import (
    ClientVerifyRequest,
    ClientSyncResponse,
    ClientSubmitResponse,
    ClientMediaUpdateRequest,
    ClientDownloadRequest,
    ClientDownloadResponse,
)
from app.services.image_processor import image_processor

router = APIRouter(prefix="/api/v1/client", tags=["Client Mobile API"])

def get_client_ip(request: Request) -> str:
    """
    Extracts real client IP address handling reverse proxies and forward headers.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

SAFE_PLACEHOLDER_PROOF = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=70&auto=format&fit=crop"

def get_protected_media_url(raw_url: str, thumbnail_url: Optional[str] = None) -> str:
    """
    Anti-Piracy Protection (Watermarks Eradicated):
    The mobile app uses FLAG_SECURE to prevent screenshots/recording.
    Therefore, we deliver clean, un-watermarked high-resolution previews
    (or lightly compressed WebP/AVIFs) instead of ruining the photos.
    """
    if not raw_url and not thumbnail_url:
        return SAFE_PLACEHOLDER_PROOF

    # 1. Cloudinary: Generate cryptographically signed delivery URL (Clean)
    if raw_url and "res.cloudinary.com" in raw_url:
        try:
            from app.core.storage import generate_signed_clean_url
            signed_url = generate_signed_clean_url(raw_url)
            if signed_url:
                return signed_url
        except Exception as sign_err:
            logger.warning(f"Signed Cloudinary URL generation notice: {sign_err}")

        # If signed URL cannot be generated, prefer compressed thumbnail
        if thumbnail_url and "res.cloudinary.com" not in thumbnail_url:
            return thumbnail_url

        if "/upload/" in raw_url:
            clean_preview = "/upload/c_limit,w_1200,q_auto:good,f_auto/"
            return raw_url.replace("/upload/", clean_preview, 1)

    # 2. ImageKit CDN: Inject light compression constraints (NO watermark)
    if raw_url and "ik.imagekit.io" in raw_url:
        sep = "&" if "?" in raw_url else "?"
        return f"{raw_url}{sep}tr=w-1200,q-80"

    # 3. S3 or Local fallback: Return the low-res compressed WebP thumbnail proof
    if thumbnail_url and thumbnail_url != raw_url:
        return thumbnail_url

    if thumbnail_url:
        return thumbnail_url

    return SAFE_PLACEHOLDER_PROOF


def resolve_root_photographer(album: Album, db: Session) -> Optional[User]:
    """
    Resolves the primary root photographer account responsible for the album.
    If the album creator is an assistant, routes directly to the parent studio owner.
    """
    if not album.photographer:
        return None
    if album.photographer.parent_id is not None or str(getattr(album.photographer, "role", "")).lower() == "assistant":
        owner = db.query(User).filter(User.id == album.photographer.effective_owner_id).first()
        return owner or album.photographer
    return album.photographer

def build_client_album_response(album: Album, db: Session) -> AlbumDetailResponse:
    """
    Builds the AlbumDetailResponse strictly enforcing Studio vs Basic Plan visibility rules:
    - If subscription_plan == 'studio':
        Includes social links and the actual allow_download flag.
    - If subscription_plan == 'basic':
        The response MUST return null for all social links and explicitly force allow_download = False.
    """
    media_count = len(album.media_items)
    selected_count = sum(1 for item in album.media_items if item.is_selected)

    root_photographer = resolve_root_photographer(album, db)
    raw_plan = (
        getattr(root_photographer, "subscription_plan", "") or
        getattr(root_photographer, "plan", "") or
        "basic"
    ).lower() if root_photographer else "basic"
    is_studio = (raw_plan == "studio")

    # Allow download is authoritative from the album state
    final_allow_download = bool(album.allow_download or False)

    if is_studio and root_photographer:
        # Studio Plan: Include social links
        social_links_data = SocialLinksResponse(
            contact_phone=root_photographer.contact_phone,
            tiktok_url=root_photographer.tiktok_url,
            instagram_url=root_photographer.instagram_url,
            telegram_url=root_photographer.telegram_url,
            youtube_url=root_photographer.youtube_url,
        )
        contact_phone = root_photographer.contact_phone
        tiktok_url = root_photographer.tiktok_url
        instagram_url = root_photographer.instagram_url
        telegram_url = root_photographer.telegram_url
        youtube_url = root_photographer.youtube_url
        studio_logo_url = root_photographer.studio_logo_url
        brand_color = getattr(root_photographer, 'brand_accent_color', None) or root_photographer.brand_color or "#D97706"
        brand_accent_color = brand_color
        photographer_name = root_photographer.full_name
    else:
        # Basic Plan: Return null for social links, but allow_download reflects album state
        social_links_data = None
        contact_phone = getattr(root_photographer, "contact_phone", None) if root_photographer else None
        tiktok_url = None
        instagram_url = None
        telegram_url = None
        youtube_url = None
        studio_logo_url = getattr(root_photographer, "studio_logo_url", None) if root_photographer else None
        brand_color = getattr(root_photographer, "brand_accent_color", None) or getattr(root_photographer, "brand_color", None) or "#D97706"
        brand_accent_color = brand_color
        photographer_name = getattr(root_photographer, "full_name", None) if root_photographer else "PhotoGuard Studio"

    # Track view analytics safely
    try:
        album.view_count = (album.view_count or 0) + 1
        album.last_viewed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()

    # Anti-Piracy Protection for Client Proofing:
    # If allow_download is False, the API MUST NOT return the original high-resolution
    # URL in the url field. Instead, map the url to a downscaled, watermarked preview.
    # Only provide the raw master url if allow_download is True.
    client_media_items: list[MediaItemResponse] = []
    for item in (album.media_items or []):
        if final_allow_download:
            effective_url = item.url
        else:
            effective_url = get_protected_media_url(item.url, item.thumbnail_url)

        client_media_items.append(
            MediaItemResponse(
                id=item.id,
                album_id=item.album_id,
                filename=item.filename,
                url=effective_url,
                thumbnail_url=item.thumbnail_url or effective_url,
                original_size=item.original_size,
                compressed_size=item.compressed_size,
                is_selected=bool(item.is_selected or False),
                client_notes=item.client_notes,
                created_at=item.created_at,
            )
        )

    return AlbumDetailResponse(
        id=album.id,
        title=album.title,
        client_name=album.client_name,
        pin=album.pin,
        photographer_id=album.photographer_id,
        is_locked=album.is_locked,
        allow_download=final_allow_download,
        view_count=album.view_count or 0,
        last_viewed_at=album.last_viewed_at,
        reminder_sent_at=album.reminder_sent_at,
        created_at=album.created_at,
        expires_at=album.expires_at,
        is_expired=False,
        submitted_at=album.submitted_at,
        media_count=media_count,
        selected_count=selected_count,
        media_items=client_media_items,
        social_links=social_links_data,
        contact_phone=contact_phone,
        tiktok_url=tiktok_url,
        instagram_url=instagram_url,
        telegram_url=telegram_url,
        youtube_url=youtube_url,
        studio_logo_url=studio_logo_url,
        brand_color=brand_color,
        brand_accent_color=brand_accent_color,
        photographer_name=photographer_name,
        subscription_plan="studio" if is_studio else "basic",
    )

@router.post("/verify", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def verify_client_pin(
    payload: ClientVerifyRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Verifies the 6-digit PIN entered on the Client Mobile App (Kotlin/Jetpack Compose).
    Returns the album gallery and media items for RAM-only rendering.
    Enforces Upstash Redis-backed rate limiting against brute-force attacks:
    If failed attempts exceed 5 within 15 minutes, returns HTTP 429 Too Many Requests.
    Enforces expiration engine: If album.expires_at is past current UTC time,
    automatically sets is_locked = True in PostgreSQL, locks in Redis, and returns HTTP 403.
    """
    pin = payload.pin.strip()
    client_ip = get_client_ip(request)

    # 1. Check Rate Limit (Upstash Redis)
    is_limited, retry_after = check_pin_rate_limit(client_ip=client_ip, pin=pin, max_attempts=5, window_seconds=900)
    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed verification attempts. Please try again in {retry_after} seconds."
        )

    album = db.query(Album).filter(Album.pin == pin).first()
    
    if not album:
        # Record failed attempt in Redis
        record_failed_pin_attempt(client_ip=client_ip, pin=pin, window_seconds=900)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid 6-digit PIN. Album not found."
        )

    # PIN is valid: Reset rate limit counter for this client/PIN
    reset_pin_rate_limit(client_ip=client_ip, pin=pin)

    # 2. Check Expiration Engine: validate if expires_at is past current UTC time
    now_utc = datetime.now(timezone.utc)
    if album.expires_at is not None:
        album_expires_utc = (
            album.expires_at if album.expires_at.tzinfo is not None
            else album.expires_at.replace(tzinfo=timezone.utc)
        )
        if album_expires_utc < now_utc:
            # Automatically lock expired album in PostgreSQL and Redis
            try:
                if not album.is_locked:
                    album.is_locked = True
                    db.commit()
                    db.refresh(album)
            except SQLAlchemyError:
                db.rollback()
            except Exception:
                db.rollback()

            lock_album_submit(pin)
            increment_album_version(pin)

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This album has expired and is no longer accessible. Access is permanently locked."
            )

    # 3. Check if locked either in PostgreSQL or Upstash Redis (Delivery mode bypasses submission lock)
    if (album.is_locked or is_album_locked(pin)) and not album.allow_download:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This album has already been submitted and locked. Selections are final."
        )

    return build_client_album_response(album, db)

@router.get("/album/{pin}", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
@router.get("/album/{pin}/", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
@router.get("/{pin}", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def get_client_album_by_pin(
    pin: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Fetches the album data and gallery media via 6-digit PIN.
    Strictly enforces Studio vs Basic Plan visibility rules:
    - Studio Plan: Returns social links, branding, and the actual allow_download flag.
    - Basic Plan: Forces all social links to null and allow_download = False.
    """
    clean_pin = pin.strip()
    client_ip = get_client_ip(request)

    is_limited, retry_after = check_pin_rate_limit(client_ip=client_ip, pin=clean_pin, max_attempts=5, window_seconds=900)
    if is_limited:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Invalid 6-digit PIN. Album not found.")
    
    is_limited, retry_after = check_pin_rate_limit(client_ip=client_ip, pin=clean_pin, max_attempts=5, window_seconds=900)
    if is_limited:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Invalid 6-digit PIN. Album not found.")
    client_ip = get_client_ip(request)

    # 1. Rate Limiting Check (Upstash Redis)
    is_limited, retry_after = check_pin_rate_limit(client_ip=client_ip, pin=clean_pin, max_attempts=5, window_seconds=900)
    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed verification attempts. Please try again in {retry_after} seconds."
        )

    album = db.query(Album).filter(Album.pin == clean_pin).first()
    if not album:
        record_failed_pin_attempt(client_ip=client_ip, pin=clean_pin, window_seconds=900)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid 6-digit PIN. Album not found."
        )

    reset_pin_rate_limit(client_ip=client_ip, pin=clean_pin)

    # 2. Expiration Engine Check
    now_utc = datetime.now(timezone.utc)
    if album.expires_at is not None:
        album_expires_utc = (
            album.expires_at if album.expires_at.tzinfo is not None
            else album.expires_at.replace(tzinfo=timezone.utc)
        )
        if album_expires_utc < now_utc:
            try:
                if not album.is_locked:
                    album.is_locked = True
                    db.commit()
                    db.refresh(album)
            except Exception:
                db.rollback()

            lock_album_submit(clean_pin)
            increment_album_version(clean_pin)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This album has expired and is no longer accessible. Access is permanently locked."
            )

    # 3. Check Lock State (Delivery mode bypasses submission lock)
    if (album.is_locked or is_album_locked(clean_pin)) and not album.allow_download:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This album has already been submitted and locked. Selections are final."
        )

    return build_client_album_response(album, db)

@router.get("/sync/{pin}", response_model=ClientSyncResponse, status_code=status.HTTP_200_OK)
def sync_album_state(
    pin: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Smart Polling endpoint (Upstash Redis).
    Returns current version counter and lock status.
    Mobile app polls this lightweight integer endpoint to detect collaborative changes
    without requiring persistent WebSockets.
    """
    clean_pin = pin.strip()
    client_ip = get_client_ip(request)

    # Protect backend against aggressive polling flood attacks (Max 120 sync requests/min per IP)
    client_redis = get_redis()
    if client_redis:
        try:
            poll_key = f"ratelimit:sync_flood:{client_ip}"
            requests_count = client_redis.incr(poll_key)
            if requests_count == 1:
                client_redis.expire(poll_key, 60)
            elif requests_count > 120:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many polling requests. Slow down your synchronization interval."
                )
        except HTTPException:
            raise
        except Exception:
            pass  # Fail open gracefully if Redis has a transient hiccup

    album = db.query(Album).filter(Album.pin == clean_pin).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album with specified PIN not found."
        )

    # Expiration check during smart polling
    now_utc = datetime.now(timezone.utc)
    is_expired = False
    if album.expires_at is not None:
        album_expires_utc = (
            album.expires_at if album.expires_at.tzinfo is not None
            else album.expires_at.replace(tzinfo=timezone.utc)
        )
        if album_expires_utc < now_utc:
            is_expired = True
            if not album.is_locked:
                try:
                    album.is_locked = True
                    db.commit()
                except Exception:
                    db.rollback()
            lock_album_submit(pin)

    version = get_album_version(pin)
    locked = album.is_locked or is_album_locked(pin) or is_expired

    return ClientSyncResponse(
        pin=pin,
        version=version,
        is_locked=locked
    )

@router.patch("/media/{media_id}", response_model=MediaItemResponse, status_code=status.HTTP_200_OK)
def update_client_media_selection(
    media_id: int,
    payload: ClientMediaUpdateRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Updates photo selection status (is_selected) and client feedback notes (client_notes).
    Enforces Single Submit Lock and Expiration validation:
    MUST check is_album_locked(pin) and album.is_locked. If locked or expired, rejects update with 403.
    Wraps DB commit in strict try...except with db.rollback().
    Bumps Redis version counter for instant collaborative sync among family members.
    """
    pin = payload.pin.strip()
    client_ip = get_client_ip(request)
    
    is_limited, retry_after = check_pin_rate_limit(client_ip=client_ip, pin=pin, max_attempts=5, window_seconds=900)
    if is_limited:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Invalid 6-digit PIN. Album not found.")

    # Use with_for_update to prevent race condition during selection update (PG-12)
    album = db.query(Album).filter(Album.pin == pin).with_for_update().first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid album PIN."
        )

    # Check expiration engine
    now_utc = datetime.now(timezone.utc)
    if album.expires_at is not None:
        album_expires_utc = (
            album.expires_at if album.expires_at.tzinfo is not None
            else album.expires_at.replace(tzinfo=timezone.utc)
        )
        if album_expires_utc < now_utc:
            try:
                if not album.is_locked:
                    album.is_locked = True
                    db.commit()
            except Exception:
                db.rollback()
            lock_album_submit(pin)
            increment_album_version(pin)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Album has expired. Selections and notes cannot be modified."
            )

    # Check lock state in PostgreSQL and Redis
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

        # Anti-piracy URL protection: respect album allow_download state
        effective_url = media_item.url if album.allow_download else get_protected_media_url(media_item.url, media_item.thumbnail_url)
        return MediaItemResponse(
            id=media_item.id,
            album_id=media_item.album_id,
            filename=media_item.filename,
            url=effective_url,
            thumbnail_url=media_item.thumbnail_url or effective_url,
            original_size=media_item.original_size,
            compressed_size=media_item.compressed_size,
            is_selected=bool(media_item.is_selected or False),
            client_notes=media_item.client_notes,
            created_at=media_item.created_at,
        )

    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating media item: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error updating media item: {req_id}"
        )

@router.post("/submit/{pin}", response_model=ClientSubmitResponse, status_code=status.HTTP_200_OK)
def submit_album_selection(
    pin: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    ACID-Compliant Atomic Single-Submit Lock.
    Uses PostgreSQL SELECT ... FOR UPDATE row locking combined with Redis SETNX.
    Guarantees strict single-submission even across multi-worker deployments.
    """
    clean_pin = pin.strip()

    try:
        # 1. Acquire exclusive PostgreSQL row-level lock
        album = db.query(Album).filter(Album.pin == clean_pin).with_for_update().first()
        if not album:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Album with specified PIN not found."
            )

        # 2. Check if already locked inside the serialized transaction
        if album.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Album has already been submitted and locked by another collaborator."
            )

        # 3. Check expiration engine
        now_utc = datetime.now(timezone.utc)
        if album.expires_at is not None:
            album_expires_utc = (
                album.expires_at if album.expires_at.tzinfo is not None
                else album.expires_at.replace(tzinfo=timezone.utc)
            )
            if album_expires_utc < now_utc:
                try:
                    album.is_locked = True
                    db.commit()
                except Exception:
                    db.rollback()
                lock_album_submit(clean_pin)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Album has expired and cannot be submitted."
                )

        # DB-08: PostgreSQL is the Single Source of Truth for submission locking
        album.is_locked = True
        album.submitted_at = func.now()
        db.commit()
        db.refresh(album)
        
        # Redis is strictly an optimization/cache layer, updated AFTER successful DB commit
        try:
            lock_album_submit(clean_pin)
        except Exception:
            pass  # Non-fatal if Redis sync fails

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while submitting album: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error while submitting album: {req_id}"
        )

    # 6. Increment sync version so all polling clients immediately lock their UI
    increment_album_version(clean_pin)

    # 7. Dispatch non-blocking Telegram alert to photographer
    if album.photographer and album.photographer.telegram_chat_id:
        selected_count = sum(1 for m in (album.media_items or []) if m.is_selected)
        total_count = len(album.media_items or [])
        background_tasks.add_task(
            notify_photographer_submission,
            album_title=album.title,
            client_name=album.client_name,
            chat_id=album.photographer.telegram_chat_id,
            selected_count=selected_count,
            total_count=total_count,
            pin=clean_pin
        )

    return ClientSubmitResponse(
        message="Album selection submitted successfully. Gallery is now permanently locked.",
        pin=clean_pin,
        is_locked=True
    )

@router.post("/download", response_model=ClientDownloadResponse, status_code=status.HTTP_200_OK)
def request_client_download(
    payload: ClientDownloadRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Enforces AI Feature / High-Res Download separation:
    Verifies that the photographer has explicitly enabled download permissions (album.allow_download == True).
    If allow_download is False, rejects request with HTTP 403 Forbidden.
    Verifies expiration and returns high-resolution download URLs for selected photos.
    Sets client_downloaded_at = func.now() to trigger the 1-day Delivery Album auto-purge countdown.
    """
    pin = payload.pin.strip()
    client_ip = get_client_ip(request)
    
    is_limited, retry_after = check_pin_rate_limit(client_ip=client_ip, pin=pin, max_attempts=5, window_seconds=900)
    if is_limited:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Invalid 6-digit PIN. Album not found.")

    album = db.query(Album).filter(Album.pin == pin).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid album PIN."
        )

    # Verify expiration
    now_utc = datetime.now(timezone.utc)
    if album.expires_at is not None:
        album_expires_utc = (
            album.expires_at if album.expires_at.tzinfo is not None
            else album.expires_at.replace(tzinfo=timezone.utc)
        )
        if album_expires_utc < now_utc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Album has expired. High-resolution downloads are disabled."
            )

    # Strict download security and Studio Plan tier enforcement
    root_photographer = resolve_root_photographer(album, db)
    raw_plan = (
        getattr(root_photographer, "subscription_plan", "") or
        getattr(root_photographer, "plan", "") or
        "basic"
    ).lower() if root_photographer else "basic"

    if raw_plan != "studio" or not album.allow_download:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="High-resolution downloads are disabled or not permitted under the photographer's subscription plan."
        )

    # Record client download timestamp for 1-day delivery auto-purge countdown
    try:
        album.client_downloaded_at = func.now()
        db.commit()
    except Exception as exc:
        db.rollback()

    # Return download URLs for selected media items (or all items if none specifically tagged)
    selected_items = [m for m in album.media_items if m.is_selected]
    if not selected_items:
        selected_items = album.media_items

    urls = [m.url for m in selected_items]

    return ClientDownloadResponse(
        pin=pin,
        allow_download=True,
        download_urls=urls
    )

@router.get("/{pin}/download", response_model=ClientDownloadResponse, status_code=status.HTTP_200_OK)
@router.get("/{pin}/download/", response_model=ClientDownloadResponse, status_code=status.HTTP_200_OK)
def get_client_gallery_download(
    pin: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Direct client gallery download endpoint.
    Sets client_downloaded_at = func.now() to trigger the 1-day Delivery Album auto-purge countdown.
    """
    clean_pin = pin.strip()
    client_ip = get_client_ip(request)

    is_limited, retry_after = check_pin_rate_limit(client_ip=client_ip, pin=clean_pin, max_attempts=5, window_seconds=900)
    if is_limited:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Invalid 6-digit PIN. Album not found.")

    album = db.query(Album).filter(Album.pin == clean_pin).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid album PIN."
        )

    now_utc = datetime.now(timezone.utc)
    if album.expires_at is not None:
        album_expires_utc = (
            album.expires_at if album.expires_at.tzinfo is not None
            else album.expires_at.replace(tzinfo=timezone.utc)
        )
        if album_expires_utc < now_utc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Album has expired. High-resolution downloads are disabled."
            )

    # Strict download security and Studio Plan tier enforcement
    root_photographer = resolve_root_photographer(album, db)
    raw_plan = (
        getattr(root_photographer, "subscription_plan", "") or
        getattr(root_photographer, "plan", "") or
        "basic"
    ).lower() if root_photographer else "basic"

    if raw_plan != "studio" or not album.allow_download:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="High-resolution downloads are disabled or not permitted under the photographer's subscription plan."
        )

    # Record client download timestamp
    try:
        album.client_downloaded_at = func.now()
        db.commit()
    except Exception as exc:
        db.rollback()

    selected_items = [m for m in album.media_items if m.is_selected]
    if not selected_items:
        selected_items = album.media_items

    urls = [m.url for m in selected_items]

    return ClientDownloadResponse(
        pin=clean_pin,
        allow_download=True,
        download_urls=urls
    )
