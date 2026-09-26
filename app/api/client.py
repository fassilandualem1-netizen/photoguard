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
    FaceSearchResponse,
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

    if is_studio and root_photographer:
        # Studio Plan: Include social links and actual photographer-configured allow_download flag
        final_allow_download = bool(album.allow_download or False)
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
        brand_color = root_photographer.brand_color or "#F59E0B"
        photographer_name = root_photographer.full_name
    else:
        # Basic Plan: Strictly return null for all social links and explicitly force allow_download = False
        final_allow_download = False
        social_links_data = None
        contact_phone = getattr(root_photographer, "contact_phone", None) if root_photographer else None
        tiktok_url = None
        instagram_url = None
        telegram_url = None
        youtube_url = None
        studio_logo_url = getattr(root_photographer, "studio_logo_url", None) if root_photographer else None
        brand_color = getattr(root_photographer, "brand_color", None) or "#F59E0B"
        photographer_name = getattr(root_photographer, "full_name", None) if root_photographer else "PhotoGuard Studio"

    # Track view analytics safely
    try:
        album.view_count = (album.view_count or 0) + 1
        album.last_viewed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()

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
        media_items=album.media_items,
        social_links=social_links_data,
        contact_phone=contact_phone,
        tiktok_url=tiktok_url,
        instagram_url=instagram_url,
        telegram_url=telegram_url,
        youtube_url=youtube_url,
        studio_logo_url=studio_logo_url,
        brand_color=brand_color,
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

    # 3. Check if locked either in PostgreSQL or Upstash Redis
    if album.is_locked or is_album_locked(pin):
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

    # 3. Check Lock State
    if album.is_locked or is_album_locked(clean_pin):
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
    
    # Verify PIN access to the target album
    album = db.query(Album).filter(Album.pin == pin).first()
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

        # 4. Enforce atomic single-submit lock via Redis setnx
        lock_acquired = lock_album_submit(clean_pin)
        if not lock_acquired:
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

        # 5. Persist lock and submission timestamp atomically in PostgreSQL
        album.is_locked = True
        album.submitted_at = func.now()
        db.commit()
        db.refresh(album)

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while submitting album: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error while submitting album: {str(exc)}"
        )

    # 6. Increment sync version so all polling clients immediately lock their UI
    increment_album_version(clean_pin)

    # 7. Dispatch non-blocking Telegram alert to photographer
    if album.photographer and album.photographer.telegram_chat_id:
        background_tasks.add_task(
            notify_photographer_submission,
            album_title=album.title,
            client_name=album.client_name,
            chat_id=album.photographer.telegram_chat_id
        )

    return ClientSubmitResponse(
        message="Album selection submitted successfully. Gallery is now permanently locked.",
        pin=clean_pin,
        is_locked=True
    )

@router.post("/download", response_model=ClientDownloadResponse, status_code=status.HTTP_200_OK)
def request_client_download(
    payload: ClientDownloadRequest,
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
    db: Session = Depends(get_db)
):
    """
    Direct client gallery download endpoint.
    Sets client_downloaded_at = func.now() to trigger the 1-day Delivery Album auto-purge countdown.
    """
    clean_pin = pin.strip()
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

@router.post("/album/{pin}/face-search", response_model=FaceSearchResponse, status_code=status.HTTP_200_OK)
async def search_photos_by_face(
    pin: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Client Mobile App (Kotlin/Jetpack Compose) AI Face Recognition Search:
    1. Validates the 6-digit album PIN.
    2. Studio Plan Check: Confirms the album photographer is subscribed to the Studio Plan.
    3. Extracts face encodings from the client's uploaded selfie.
    4. Compares against all media items in the album using vector face distance (tolerance=0.6).
    5. Returns matching media item IDs instantly for RAM-only client rendering.
    """
    clean_pin = pin.strip()
    album = db.query(Album).filter(Album.pin == clean_pin).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found."
        )

    # Expiration check
    now_utc = datetime.now(timezone.utc)
    if album.expires_at is not None:
        album_expires_utc = (
            album.expires_at if album.expires_at.tzinfo is not None
            else album.expires_at.replace(tzinfo=timezone.utc)
        )
        if album_expires_utc < now_utc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Album has expired."
            )

    # Studio Plan check on the photographer who owns this album
    photographer = album.photographer
    if not photographer or photographer.subscription_plan != "studio":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI Face Search is an exclusive Studio Plan feature. Please ask your photographer to upgrade to the Studio Plan."
        )

    # Read selfie image bytes
    try:
        selfie_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read selfie image: {str(exc)}"
        )

    if not selfie_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selfie image file is empty."
        )

    # Collect media records with face encodings
    media_records = [
        {"id": item.id, "face_encodings": item.face_encodings}
        for item in album.media_items
        if item.face_encodings
    ]

    matched_ids = image_processor.search_faces_in_album(
        selfie_bytes=selfie_bytes,
        media_records=media_records,
        tolerance=0.6
    )

    return FaceSearchResponse(
        pin=clean_pin,
        total_matched=len(matched_ids),
        matched_media_ids=matched_ids,
        message=f"Found {len(matched_ids)} matching photo(s) in album." if matched_ids else "No matching faces found in this album."
    )

