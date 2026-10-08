import os
import uuid
import logging
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, File, UploadFile, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_, func, case

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.s3_cleanup import delete_file_from_s3
from app.core.storage import delete_file_from_cloudinary, destroy_media_asset
from app.models.user import User, UserRole
from app.models.album import Album, MediaItem, generate_album_pin
from app.services.plan_service import get_or_create_plan_config
from app.schemas.album import (
    AlbumCreate,
    AlbumUpdate,
    AlbumExtendRequest,
    AlbumListItemResponse,
    AlbumDetailResponse,
    MediaItemResponse,
)

logger = logging.getLogger("photoguard.albums")

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

def check_is_expired(expires_at: Optional[datetime]) -> bool:
    """
    Helper function to calculate accurate UTC expiration state.
    """
    if expires_at is None:
        return False
    now_utc = datetime.now(timezone.utc)
    target_utc = expires_at if expires_at.tzinfo is not None else expires_at.replace(tzinfo=timezone.utc)
    return target_utc < now_utc

def serialize_media_item(m: MediaItem) -> MediaItemResponse:
    """
    Guarantees null-safe serialization for a media item with dynamic CLD-01 / S3-01 signing.
    """
    from app.core.storage import generate_signed_clean_url, generate_s3_presigned_url
    
    high_res = m.url or ""
    thumb = m.thumbnail_url
    
    if high_res and "res.cloudinary.com" in high_res:
        high_res = generate_signed_clean_url(high_res) or high_res
    elif high_res and high_res.startswith("s3://"):
        high_res = generate_s3_presigned_url(high_res) or high_res
        
    if thumb and "res.cloudinary.com" in thumb:
        thumb = generate_signed_clean_url(thumb) or thumb
    elif thumb and thumb.startswith("s3://"):
        thumb = generate_s3_presigned_url(thumb) or thumb
        
    return MediaItemResponse(
        id=m.id,
        album_id=m.album_id,
        filename=m.filename or "",
        url=high_res,
        thumbnail_url=thumb,
        original_size=int(m.original_size or 0),
        compressed_size=int(m.compressed_size or 0),
        is_selected=bool(m.is_selected or False),
        client_notes=m.client_notes,
        created_at=m.created_at,
    )

def resolve_creator_info(creator_user: Optional[User]) -> tuple[str, str]:
    """
    Returns (creator_name, creator_role) where creator_role is 'photographer' (Owner) or 'assistant'.
    """
    if not creator_user:
        return ("Studio Owner", "photographer")
    
    role = str(getattr(creator_user, "role", "") or "").lower().strip()
    is_assistant = (role == "assistant" or creator_user.parent_id is not None)
    creator_role = "assistant" if is_assistant else "photographer"
    creator_name = creator_user.full_name or ("Studio Assistant" if is_assistant else "Studio Owner")
    return (creator_name, creator_role)

def check_album_access(album: Album, current_user: User, db: Session) -> bool:
    """
    Strict Album Access Control & Data Isolation:
    - Admin: Full access across all platform albums.
    - Studio Assistant: Can ONLY access albums they created themselves (album.photographer_id == current_user.id).
    - Main Photographer (Owner): Can access albums created by themselves AND any of their assistants.
    """
    if current_user.role == UserRole.ADMIN.value or current_user.role == UserRole.ADMIN:
        return True

    user_role = str(getattr(current_user, "role", "") or "").lower()
    is_assistant = (
        user_role == UserRole.ASSISTANT.value
        or user_role == "assistant"
        or current_user.parent_id is not None
    )

    # 1. Studio Assistant Isolation
    if is_assistant:
        return album.photographer_id == current_user.id

    # 2. Main Photographer
    if album.photographer_id == current_user.id:
        return True

    # Verify if album creator is an assistant linked to this photographer
    creator = db.query(User.parent_id).filter(User.id == album.photographer_id).first()
    if creator and creator.parent_id == current_user.id:
        return True

    return False

@router.post("", response_model=AlbumDetailResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=AlbumDetailResponse, status_code=status.HTTP_201_CREATED)
def create_album(
    payload: AlbumCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new Album.
    Permissions:
    - Main Photographers (Owners), Studio Assistants, and Administrators can create albums.
    - If current_user.role == "photographer", they are the owner, using their own ID
      as the root photographer_id for the album and quota checks.
    - If current_user.role == "assistant", routes quota checks to their parent photographer.
    - Generates or assigns a unique 6-digit access PIN.
    """
    # 1. Normalize and validate role check (Explicitly allow photographer and assistant)
    user_role = str(getattr(current_user, "role", "") or "").lower().strip()
    allowed_roles = {"photographer", "assistant", "admin", "owner"}

    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to create albums."
        )

    # 2. Owner Resolution & Root Photographer ID Assignment
    # If current_user.role == "photographer" (or "owner"), they are the owner directly
    if user_role in ("photographer", "owner"):
        root_photographer_id = current_user.id
        owner = current_user
    elif user_role == "assistant":
        # For assistants, quota and subscription plan belong to the parent photographer account
        root_photographer_id = current_user.parent_id if current_user.parent_id is not None else current_user.id
        owner = db.query(User).filter(User.id == root_photographer_id).first() or current_user
    elif user_role == "admin":
        root_photographer_id = current_user.id
        owner = current_user
    else:
        root_photographer_id = current_user.id
        owner = current_user

    # Storage Quota Check on Owner
    if owner.storage_quota_limit > 0 and owner.storage_used >= owner.storage_quota_limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Storage quota exceeded for this studio account. Please upgrade your photographer plan."
        )

    # Validate or generate unique 6-digit PIN
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

    # Dynamic Tier Gate based on owner's plan configuration
    user_plan = getattr(owner, "subscription_plan", "basic") or "basic"
    plan_cfg = get_or_create_plan_config(db, user_plan)
    is_admin = (user_role == "admin")

    # Dynamic download permission
    if is_admin or plan_cfg.can_enable_downloads:
        final_allow_download = bool(payload.allow_download or False)
    else:
        final_allow_download = False

    # Dynamic lifespan calculation: strictly enforce 15-day maximum album lifespan
    MAX_ALBUM_LIFESPAN = 15
    DEFAULT_ALBUM_LIFESPAN = 15

    if payload.expires_in_days is not None:
        expires_days = min(max(1, payload.expires_in_days), MAX_ALBUM_LIFESPAN)
    elif is_admin:
        expires_days = min(getattr(plan_cfg, "default_lifespan_days", DEFAULT_ALBUM_LIFESPAN) or DEFAULT_ALBUM_LIFESPAN, MAX_ALBUM_LIFESPAN)
    else:
        expires_days = min(getattr(plan_cfg, "default_lifespan_days", DEFAULT_ALBUM_LIFESPAN) or DEFAULT_ALBUM_LIFESPAN, MAX_ALBUM_LIFESPAN)

    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(days=expires_days)

    try:
        album = Album(
            title=payload.title,
            client_name=payload.client_name,
            pin=assigned_pin,
            photographer_id=current_user.id,  # Set to current user (owner or assistant)
            allow_download=final_allow_download,
            is_locked=False,
            expires_at=expires_at,
            submitted_at=None
        )
        
        db.add(album)
        db.commit()
        db.refresh(album)

        logger.info(f"[Albums API] User #{current_user.id} ({user_role}) created album #{album.id} (Owner: #{root_photographer_id}).")

        creator_name, creator_role = resolve_creator_info(current_user)

        return AlbumDetailResponse(
            id=album.id,
            title=album.title or "Untitled Album",
            client_name=album.client_name or "Unknown Client",
            pin=album.pin or "",
            photographer_id=album.photographer_id,
            is_locked=bool(album.is_locked or False),
            allow_download=bool(album.allow_download or False),
            created_at=album.created_at,
            expires_at=album.expires_at,
            is_expired=check_is_expired(album.expires_at),
            submitted_at=album.submitted_at,
            media_count=0,
            selected_count=0,
            creator_name=creator_name,
            creator_role=creator_role,
            media_items=[]
        )
    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        logger.error(f"[Albums API] Database error creating album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error creating album: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Unexpected error creating album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error creating album: {req_id}"
        )

@router.get("", response_model=List[AlbumListItemResponse], status_code=status.HTTP_200_OK)
@router.get("/", response_model=List[AlbumListItemResponse], status_code=status.HTTP_200_OK)
def list_albums(
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(100, ge=1, le=500, description="Limit for pagination"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists albums with strict data isolation:
    - Administrators: Receive all albums platform-wide.
    - Studio Assistants: Strictly receive albums they created themselves (photographer_id == current_user.id).
    - Main Photographers: Receive their own albums AND albums created by any of their studio assistants.
    """
    try:
        user_role = str(getattr(current_user, "role", "") or "").lower()
        is_assistant = (
            user_role == UserRole.ASSISTANT.value
            or user_role == "assistant"
            or current_user.parent_id is not None
        )

        if current_user.role == UserRole.ADMIN.value or current_user.role == UserRole.ADMIN:
            albums = (
                db.query(Album)
                .order_by(Album.created_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )
        elif is_assistant:
            # Studio Assistant: Strictly albums they created
            albums = (
                db.query(Album)
                .filter(Album.photographer_id == current_user.id)
                .order_by(Album.created_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )
        else:
            # Main Photographer: Own albums + all albums created by their assistants
            assistant_ids = [
                r[0] for r in db.query(User.id).filter(User.parent_id == current_user.id).all()
            ]
            allowed_photographer_ids = [current_user.id] + assistant_ids
            albums = (
                db.query(Album)
                .filter(Album.photographer_id.in_(allowed_photographer_ids))
                .order_by(Album.created_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )

        album_ids = [alb.id for alb in albums]
        # SQL-level aggregation: calculates media_count and selected_count without loading any ORM MediaItem objects
        counts_by_album = {}
        if album_ids:
            media_stats = (
                db.query(
                    MediaItem.album_id,
                    func.count(MediaItem.id).label("total_count"),
                    func.coalesce(func.sum(case((MediaItem.is_selected == True, 1), else_=0)), 0).label("selected_count")
                )
                .filter(MediaItem.album_id.in_(album_ids))
                .group_by(MediaItem.album_id)
                .all()
            )
            counts_by_album = {row.album_id: (int(row.total_count or 0), int(row.selected_count or 0)) for row in media_stats}

        # Batch-fetch all creators for albums in a single query
        creator_ids = {alb.photographer_id for alb in albums if alb.photographer_id}
        creators_by_id = {}
        if creator_ids:
            creator_users = db.query(User).filter(User.id.in_(creator_ids)).all()
            for u in creator_users:
                creators_by_id[u.id] = u

        result = []
        for alb in albums:
            media_count, selected_count = counts_by_album.get(alb.id, (0, 0))
            creator_user = creators_by_id.get(alb.photographer_id)
            creator_name, creator_role = resolve_creator_info(creator_user)

            result.append(
                AlbumListItemResponse(
                    id=alb.id,
                    title=alb.title or "Untitled Album",
                    client_name=alb.client_name or "Unknown Client",
                    pin=alb.pin or "",
                    photographer_id=alb.photographer_id,
                    is_locked=bool(alb.is_locked or False),
                    allow_download=bool(alb.allow_download or False),
                    created_at=alb.created_at,
                    expires_at=alb.expires_at,
                    is_expired=check_is_expired(alb.expires_at),
                    submitted_at=alb.submitted_at,
                    is_submitted=bool(alb.is_locked or alb.submitted_at is not None),
                    media_count=media_count,
                    selected_count=selected_count,
                    creator_name=creator_name,
                    creator_role=creator_role
                )
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[Albums API] Error in list_albums: {req_id}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve albums: {req_id}"
        )

@router.get("/{album_id}", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
@router.get("/{album_id}/", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def get_album(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches full album details including associated media items.
    Enforces strict ownership & assistant data isolation permissions.
    """
    try:
        album = db.query(Album).filter(Album.id == album_id).first()
        if not album:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

        if not check_album_access(album, current_user, db):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

        media_items = album.media_items or []

        # Automatic Deduplication: Clean up duplicate filenames from interrupted network batches
        from collections import defaultdict
        grouped = defaultdict(list)
        for m in media_items:
            key = (m.filename or "photo.jpg").strip().lower()
            grouped[key].append(m)

        has_duplicates = any(len(v) > 1 for v in grouped.values())
        if has_duplicates:
            items_to_delete = []
            reclaimed_bytes = 0
            surviving_items = []
            for key, items in grouped.items():
                selected_items = [it for it in items if bool(it.is_selected or False)]
                keeper = selected_items[-1] if selected_items else items[-1]
                surviving_items.append(keeper)
                for it in items:
                    if it.id != keeper.id:
                        items_to_delete.append(it)
                        reclaimed_bytes += int(it.original_size or 0)

            for it in items_to_delete:
                db.delete(it)

            owner = db.query(User).filter(User.id == album.photographer_id).first()
            if owner and reclaimed_bytes > 0:
                owner.storage_used = max(0, int(owner.storage_used or 0) - reclaimed_bytes)

            try:
                db.commit()
                db.refresh(album)
                media_items = surviving_items
            except Exception as dedup_err:
                db.rollback()
                logger.warning(f"Auto-deduplication commit notice: {dedup_err}")
                media_items = album.media_items or []

        media_count = len(media_items)
        selected_count = sum(1 for m in media_items if bool(m.is_selected or False))
        is_expired = check_is_expired(album.expires_at)

        safe_media_items = [serialize_media_item(m) for m in media_items]
        creator_user = db.query(User).filter(User.id == album.photographer_id).first()
        creator_name, creator_role = resolve_creator_info(creator_user)

        return AlbumDetailResponse(
            id=album.id,
            title=album.title or "Untitled Album",
            client_name=album.client_name or "Unknown Client",
            pin=album.pin or "",
            photographer_id=album.photographer_id,
            is_locked=bool(album.is_locked or False),
            allow_download=bool(album.allow_download or False),
            created_at=album.created_at,
            expires_at=album.expires_at,
            is_expired=is_expired,
            submitted_at=album.submitted_at,
            is_submitted=bool(album.is_locked or album.submitted_at is not None),
            media_count=media_count,
            selected_count=selected_count,
            creator_name=creator_name,
            creator_role=creator_role,
            media_items=safe_media_items
        )
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[Albums API] Error in get_album: {req_id}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve album details: {req_id}"
        )

@router.put("/{album_id}/extend", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
@router.put("/{album_id}/extend/", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def extend_album_expiration(
    album_id: int,
    payload: AlbumExtendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Extends expires_at by a specified number of days.
    Enforces strict access control and plan validation routed via effective_owner_id.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if not check_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    # Dynamic Tier Gate routed via Effective Owner
    owner = db.query(User).filter(User.id == current_user.effective_owner_id).first() or current_user
    user_plan = getattr(owner, "subscription_plan", "basic") or "basic"
    plan_cfg = get_or_create_plan_config(db, user_plan)
    is_admin = (current_user.role == UserRole.ADMIN.value or current_user.role == UserRole.ADMIN)

    if not is_admin and not plan_cfg.can_extend_lifespan:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Extending album lifespan is not enabled for the {user_plan.capitalize()} Plan. Please upgrade to unlock."
        )

    now_utc = datetime.now(timezone.utc)

    try:
        if album.expires_at is not None:
            current_exp_utc = (
                album.expires_at if album.expires_at.tzinfo is not None
                else album.expires_at.replace(tzinfo=timezone.utc)
            )
            base_time = max(current_exp_utc, now_utc)
        else:
            base_time = now_utc

        new_expiration = base_time + timedelta(days=payload.days)
        album.expires_at = new_expiration

        if bool(album.is_locked or False) and album.submitted_at is None:
            album.is_locked = False

        db.commit()
        db.refresh(album)

        media_items = album.media_items or []
        media_count = len(media_items)
        selected_count = sum(1 for m in media_items if bool(m.is_selected or False))
        safe_media_items = [serialize_media_item(m) for m in media_items]
        creator_user = db.query(User).filter(User.id == album.photographer_id).first()
        creator_name, creator_role = resolve_creator_info(creator_user)

        return AlbumDetailResponse(
            id=album.id,
            title=album.title or "Untitled Album",
            client_name=album.client_name or "Unknown Client",
            pin=album.pin or "",
            photographer_id=album.photographer_id,
            is_locked=bool(album.is_locked or False),
            allow_download=bool(album.allow_download or False),
            created_at=album.created_at,
            expires_at=album.expires_at,
            is_expired=check_is_expired(album.expires_at),
            submitted_at=album.submitted_at,
            media_count=media_count,
            selected_count=selected_count,
            creator_name=creator_name,
            creator_role=creator_role,
            media_items=safe_media_items
        )
    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        logger.error(f"[Albums API] Database error extending album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error extending album expiration: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Unexpected error extending album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error extending album expiration: {req_id}"
        )

@router.get("/{album_id}/export", response_model=List[MediaItemResponse], status_code=status.HTTP_200_OK)
@router.get("/{album_id}/export/", response_model=List[MediaItemResponse], status_code=status.HTTP_200_OK)
def export_album_selections(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports final client photo selections (is_selected = True) for Lightroom/Photoshop workflows.
    Enforces strict ownership & assistant data isolation access control.
    Sets photographer_downloaded_at = func.now() to trigger the 2-day auto-purge countdown.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if not check_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    # Record photographer download timestamp for selection auto-purge countdown
    try:
        album.photographer_downloaded_at = func.now()
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"Could not record photographer_downloaded_at: {exc}")

    media_items = album.media_items or []
    selected_items = [serialize_media_item(item) for item in media_items if bool(item.is_selected or False)]
    return selected_items

@router.get("/{album_id}/download", response_model=List[MediaItemResponse], status_code=status.HTTP_200_OK)
@router.get("/{album_id}/download/", response_model=List[MediaItemResponse], status_code=status.HTTP_200_OK)
def download_album_selections(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Photographer high-res download endpoint.
    Sets photographer_downloaded_at = func.now() to start the 2-day auto-purge countdown for Selection Albums.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if not check_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    # Record photographer download timestamp
    try:
        album.photographer_downloaded_at = func.now()
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"Could not record photographer_downloaded_at: {exc}")

    media_items = album.media_items or []
    selected_items = [serialize_media_item(item) for item in media_items if bool(item.is_selected or False)]
    if not selected_items:
        selected_items = [serialize_media_item(item) for item in media_items]

    return selected_items

@router.get("/{album_id}/download-zip")
async def download_album_zip(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Downloads all client selections (or all proofs if none marked) as a clean ZIP archive with 00_JOB_SHEET.txt.
    Streams directly to the browser for instant one-click studio download.
    """
    import io
    import zipfile
    import httpx
    from fastapi.responses import StreamingResponse

    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if not check_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    media_items = album.media_items or []
    target_photos = [m for m in media_items if bool(m.is_selected or False)]
    if not target_photos:
        target_photos = media_items

    if not target_photos:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No photos to download.")

    # Record photographer download timestamp for selection auto-purge countdown
    try:
        album.photographer_downloaded_at = func.now()
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"Could not record photographer_downloaded_at: {exc}")

    # Build 00_JOB_SHEET.txt
    album_title = album.title or "Gallery"
    pin = album.pin or "N/A"
    sheet_lines = [
        "============================================================",
        "PHOTOGUARD - RETOUCHING JOB SHEET",
        f"Album: {album_title} | PIN: {pin} | Total Photos: {len(target_photos)}",
        "============================================================\n"
    ]
    for idx, item in enumerate(target_photos, start=1):
        pad = f"{idx:02d}"
        fn = item.filename or f"Photo_{idx}.jpg"
        notes = f" (Client Note: {item.client_notes})" if item.client_notes else ""
        sheet_lines.append(f"[{pad}] {fn}{notes}")
    job_sheet_content = "\n".join(sheet_lines).encode("utf-8")

    # Create zip in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("00_JOB_SHEET.txt", job_sheet_content)

        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            for idx, item in enumerate(target_photos, start=1):
                pad = f"{idx:02d}"
                clean_name = item.filename or f"Photo_{idx}.jpg"
                arcname = f"{pad}_{clean_name}"
                
                try:
                    if item.url and item.url.startswith("/uploads/"):
                        local_path = os.path.join(os.getcwd(), "uploads", os.path.basename(item.url))
                        if os.path.exists(local_path):
                            with open(local_path, "rb") as f:
                                zip_file.writestr(arcname, f.read())
                            continue

                    if item.url and (item.url.startswith("http://") or item.url.startswith("https://")):
                        resp = await client.get(item.url)
                        if resp.status_code == 200:
                            zip_file.writestr(arcname, resp.content)
                        else:
                            logger.warning(f"Failed to fetch photo {item.id} for zip: {resp.status_code}")
                except Exception as img_err:
                    logger.warning(f"Error packing photo {item.id} into zip: {img_err}")

    zip_buffer.seek(0)
    safe_title = "".join(c for c in album_title if c.isalnum() or c in ("-", "_")).strip() or "Gallery"
    download_filename = f"{safe_title}_Selections.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{download_filename}"',
            "Cache-Control": "no-cache",
        }
    )

@router.patch("/{album_id}", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
@router.patch("/{album_id}/", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def update_album(
    album_id: int,
    payload: AlbumUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates album metadata, lock status, or download permissions.
    Enforces strict ownership & assistant data isolation access control.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if not check_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    try:
        if payload.title is not None:
            album.title = payload.title
        if payload.client_name is not None:
            album.client_name = payload.client_name
        if payload.is_locked is not None:
            album.is_locked = bool(payload.is_locked)
        if payload.allow_download is not None:
            owner = db.query(User).filter(User.id == current_user.effective_owner_id).first() or current_user
            user_plan = getattr(owner, "subscription_plan", "basic") or getattr(owner, "plan_tier", "basic") or "basic"
            plan_cfg = get_or_create_plan_config(db, user_plan)
            is_admin = (current_user.role == UserRole.ADMIN.value or current_user.role == UserRole.ADMIN)

            if payload.allow_download and not is_admin and not getattr(plan_cfg, "can_enable_downloads", False):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Direct Client Gallery Download is an exclusive Studio Plan feature."
                )
            album.allow_download = bool(payload.allow_download)

        db.commit()
        db.refresh(album)

        media_items = album.media_items or []
        media_count = len(media_items)
        selected_count = sum(1 for m in media_items if bool(m.is_selected or False))
        safe_media_items = [serialize_media_item(m) for m in media_items]
        creator_user = db.query(User).filter(User.id == album.photographer_id).first()
        creator_name, creator_role = resolve_creator_info(creator_user)

        return AlbumDetailResponse(
            id=album.id,
            title=album.title or "Untitled Album",
            client_name=album.client_name or "Unknown Client",
            pin=album.pin or "",
            photographer_id=album.photographer_id,
            is_locked=bool(album.is_locked or False),
            allow_download=bool(album.allow_download or False),
            created_at=album.created_at,
            expires_at=album.expires_at,
            is_expired=check_is_expired(album.expires_at),
            submitted_at=album.submitted_at,
            media_count=media_count,
            selected_count=selected_count,
            creator_name=creator_name,
            creator_role=creator_role,
            media_items=safe_media_items
        )
    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        logger.error(f"[Albums API] Database error updating album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating album: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Unexpected error updating album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error updating album: {req_id}"
        )

@router.post("/{album_id}/deduplicate", response_model=AlbumDetailResponse, status_code=status.HTTP_200_OK)
def deduplicate_album_photos(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cleans up duplicate photos uploaded to this album (e.g. from interrupted network batches).
    Preserves client selections and keeps the freshest/best photo for each unique filename.
    Reclaims storage quota on the owner account.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if not check_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    media_items = db.query(MediaItem).filter(MediaItem.album_id == album_id).order_by(MediaItem.id.asc()).all()
    if not media_items:
        return get_album(album_id, db, current_user)

    from collections import defaultdict
    grouped = defaultdict(list)
    for m in media_items:
        key = (m.filename or "photo.jpg").strip().lower()
        grouped[key].append(m)

    items_to_delete = []
    reclaimed_bytes = 0

    for key, items in grouped.items():
        if len(items) > 1:
            selected_items = [it for it in items if bool(it.is_selected or False)]
            keeper = selected_items[-1] if selected_items else items[-1]

            for it in items:
                if it.id != keeper.id:
                    items_to_delete.append(it)
                    reclaimed_bytes += int(it.original_size or 0)

    if items_to_delete:
        owner = db.query(User).filter(User.id == album.photographer_id).first()
        if owner and reclaimed_bytes > 0:
            owner.storage_used = max(0, int(owner.storage_used or 0) - reclaimed_bytes)

        for it in items_to_delete:
            db.delete(it)

        try:
            db.commit()
            db.refresh(album)
            increment_album_version(album.pin)
        except Exception as exc:
            db.rollback()
            logger.error(f"Error during album deduplication: {exc}")
            raise HTTPException(status_code=500, detail="Failed to deduplicate photos.")

    return get_album(album_id, db, current_user)

@router.delete("/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{album_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_album(
    album_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes an album and cascades removal to all its media items.
    Enforces strict ownership & assistant data isolation access control:
    - Main Photographer can delete own albums or albums created by their assistants.
    - Assistant can strictly delete only albums they created themselves.
    - Reclaims Storage Quota: decrements total original_size from photographer user.storage_used.
    - Airtight Storage Cleanup: permanently destroys BOTH item.url AND item.thumbnail_url.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if not check_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    try:
        media_items = album.media_items or []
        total_freed_bytes = sum(getattr(item, "original_size", 0) or 0 for item in media_items)

        # Resolve studio effective owner for storage quota reclamation
        album_creator = db.query(User).filter(User.id == album.photographer_id).first()
        owner = None
        if album_creator:
            owner = db.query(User).filter(User.id == (album_creator.effective_owner_id or album_creator.id)).with_for_update().first() or album_creator
        elif current_user:
            owner = db.query(User).filter(User.id == (current_user.effective_owner_id or current_user.id)).with_for_update().first() or current_user

        if owner and total_freed_bytes > 0:
            owner.storage_used = max(0, (owner.storage_used or 0) - total_freed_bytes)
            logger.info(f"[Albums API] Reclaimed {total_freed_bytes} bytes for owner {owner.email}. New storage_used: {owner.storage_used}")

        # Airtight Storage Deletion: Destroy both item.url and item.thumbnail_url
        for item in media_items:
            urls_to_delete = set()
            if item.url:
                urls_to_delete.add(item.url)
            if item.thumbnail_url:
                urls_to_delete.add(item.thumbnail_url)

            for u in urls_to_delete:
                background_tasks.add_task(destroy_media_asset, u)

        db.delete(album)
        db.commit()
        return None
    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        logger.error(f"[Albums API] Database error deleting album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error deleting album: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Albums API] Unexpected error deleting album: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error deleting album: {req_id}"
        )

@router.post("/{album_id}/upload", status_code=status.HTTP_201_CREATED)
def upload_album_photo_alias(
    album_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Direct alias endpoint to upload photo proofs to an album.
    """
    from app.api.media import upload_album_photo
    return upload_album_photo(album_id=album_id, file=file, db=db, current_user=current_user)

@router.post("/{album_id}/toggle-download", status_code=status.HTTP_200_OK)
def toggle_album_client_download(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Studio Plan Feature: Toggles client download permissions for an album.
    When enabled, clients can download high-resolution photos directly from the mobile app.
    """
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    if not check_album_access(album, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this album.")

    owner = db.query(User).filter(User.id == current_user.effective_owner_id).first() or current_user
    user_plan = getattr(owner, "subscription_plan", "basic") or getattr(owner, "plan_tier", "basic") or "basic"
    plan_cfg = get_or_create_plan_config(db, user_plan)
    is_admin = (current_user.role == UserRole.ADMIN.value or current_user.role == UserRole.ADMIN)

    if not is_admin and not plan_cfg.can_enable_downloads:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct Client Gallery Download is an exclusive Studio Plan feature. Please upgrade to Studio to enable client downloads."
        )

    album.allow_download = not bool(album.allow_download or False)
    db.commit()
    db.refresh(album)

    try:
        from app.core.redis import increment_album_version
        increment_album_version(album.pin)
    except Exception as e:
        logger.warning(f"Failed to increment Redis version on toggle-download: {e}")

    return {
        "album_id": album.id,
        "allow_download": album.allow_download,
        "message": "Client direct downloads enabled" if album.allow_download else "Client direct downloads disabled"
    }
