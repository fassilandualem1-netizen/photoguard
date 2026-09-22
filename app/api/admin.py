import secrets
import string
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.album import Album, MediaItem

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Control"])

# Pydantic Schemas for Admin API requests & responses
class PhotographerRegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    subscription_plan: Optional[str] = "basic"

class QuotaUpdateRequest(BaseModel):
    new_quota_bytes: int

class PhotographerDetailResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    subscription_plan: str
    is_verified: bool
    is_active: bool
    storage_quota_limit: int
    storage_used: int
    needs_password_change: bool
    total_albums: int
    total_media: int
    created_at: Optional[str] = None

class PhotographerRegisterResponse(BaseModel):
    message: str
    temp_password: str
    user: PhotographerDetailResponse

class PlatformStatsResponse(BaseModel):
    total_photographers: int
    total_storage_used_bytes: int
    total_storage_used_gb: float
    total_albums: int
    total_photos: int

@router.get("/stats", response_model=PlatformStatsResponse, status_code=status.HTTP_200_OK)
def get_platform_stats(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Returns global platform metrics:
    - Total Photographers
    - Total Storage Used (sum of storage_used in bytes and GB)
    - Total Albums created
    - Total Photos/Media items uploaded
    Strictly restricted to users with UserRole.ADMIN.
    """
    try:
        total_photographers = db.query(func.count(User.id)).filter(func.lower(User.role) != "admin").scalar() or 0
        total_storage_used_bytes = db.query(func.coalesce(func.sum(User.storage_used), 0)).scalar() or 0
        total_storage_used_gb = round(total_storage_used_bytes / (1024 * 1024 * 1024), 2)
        total_albums = db.query(func.count(Album.id)).scalar() or 0
        total_photos = db.query(func.count(MediaItem.id)).scalar() or 0

        return PlatformStatsResponse(
            total_photographers=total_photographers,
            total_storage_used_bytes=total_storage_used_bytes,
            total_storage_used_gb=total_storage_used_gb,
            total_albums=total_albums,
            total_photos=total_photos
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error querying platform statistics: {str(exc)}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error querying platform statistics: {str(exc)}"
        )

@router.get("/users", response_model=List[PhotographerDetailResponse], status_code=status.HTTP_200_OK)
def get_all_photographers(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Fetch all users with UserRole.PHOTOGRAPHER along with their album count
    and media storage statistics.
    """
    try:
        photographers = (
            db.query(User)
            .filter(func.lower(User.role) != "admin")
            .order_by(User.id.desc())
            .all()
        )

        results = []
        for p in photographers:
            total_albums = db.query(func.count(Album.id)).filter(Album.photographer_id == p.id).scalar() or 0
            album_ids = db.query(Album.id).filter(Album.photographer_id == p.id).subquery()
            total_media = db.query(func.count(MediaItem.id)).filter(MediaItem.album_id.in_(album_ids)).scalar() or 0

            results.append(
                PhotographerDetailResponse(
                    id=p.id,
                    email=p.email,
                    full_name=p.full_name,
                    role=p.role.value if hasattr(p.role, "value") else str(p.role),
                    subscription_plan=p.subscription_plan,
                    is_verified=p.is_verified,
                    is_active=p.is_active,
                    storage_quota_limit=p.storage_quota_limit,
                    storage_used=p.storage_used,
                    needs_password_change=p.needs_password_change,
                    total_albums=total_albums,
                    total_media=total_media,
                    created_at=p.created_at.isoformat() if p.created_at else None
                )
            )

        return results
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error fetching photographers: {str(exc)}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error fetching photographers: {str(exc)}"
        )

@router.post("/users", response_model=PhotographerRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_photographer(
    payload: PhotographerRegisterRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Register a new photographer account.
    Generates a secure 8-character password using secrets, hashes it,
    saves the user with needs_password_change=True, and returns the raw temporary password.
    """
    clean_email = payload.email.strip().lower()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{clean_email}' already exists."
        )

    plan = (payload.subscription_plan or "basic").strip().lower()
    if plan not in ["basic", "studio"]:
        plan = "basic"

    # Default quota: 5GB for basic, 25GB for studio
    default_quota = 26843545600 if plan == "studio" else 5368709120

    # Generate cryptographically secure 8-character password with letters and digits
    alphabet = string.ascii_letters + string.digits
    temp_password = "".join(secrets.choice(alphabet) for _ in range(8))
    hashed_password = get_password_hash(temp_password)

    new_user = User(
        email=clean_email,
        hashed_password=hashed_password,
        full_name=payload.full_name.strip(),
        role="photographer",
        subscription_plan=plan,
        plan=plan,
        is_verified=True,
        is_active=True,
        storage_quota_limit=default_quota,
        storage_used=0,
        needs_password_change=True
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        user_response = PhotographerDetailResponse(
            id=new_user.id,
            email=new_user.email,
            full_name=new_user.full_name,
            role=new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role),
            subscription_plan=new_user.subscription_plan,
            is_verified=new_user.is_verified,
            is_active=new_user.is_active,
            storage_quota_limit=new_user.storage_quota_limit,
            storage_used=new_user.storage_used,
            needs_password_change=new_user.needs_password_change,
            total_albums=0,
            total_media=0,
            created_at=new_user.created_at.isoformat() if new_user.created_at else None
        )

        return PhotographerRegisterResponse(
            message="User created",
            temp_password=temp_password,
            user=user_response
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error registering photographer: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error registering photographer: {str(exc)}"
        )

@router.put("/users/{id}/suspend", status_code=status.HTTP_200_OK)
def toggle_user_suspend(
    id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Toggles is_active status of a photographer account.
    """
    target_user = db.query(User).filter(User.id == id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {id} not found."
        )

    if target_user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend own administrator account."
        )

    try:
        target_user.is_active = not target_user.is_active
        db.commit()
        db.refresh(target_user)
        return {
            "message": f"User is now {'active' if target_user.is_active else 'suspended'}",
            "user_id": target_user.id,
            "is_active": target_user.is_active
        }
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error toggling user status: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error toggling user status: {str(exc)}"
        )

@router.put("/users/{id}/plan", status_code=status.HTTP_200_OK)
def toggle_user_plan(
    id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Toggles photographer's subscription_plan between 'basic' and 'studio'.
    """
    target_user = db.query(User).filter(User.id == id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {id} not found."
        )

    try:
        new_plan = "studio" if target_user.subscription_plan == "basic" else "basic"
        target_user.subscription_plan = new_plan
        target_user.plan = new_plan
        # If toggled to studio and current quota is default basic (5GB), upgrade quota to 25GB
        if new_plan == "studio" and target_user.storage_quota_limit == 5368709120:
            target_user.storage_quota_limit = 26843545600
        elif new_plan == "basic":
            if target_user.storage_quota_limit == 26843545600:
                target_user.storage_quota_limit = 5368709120
            # Strict Tier Gate: Downgrade Wipe of custom studio branding
            target_user.studio_logo_url = None
            target_user.brand_color = "#F59E0B"

        db.commit()
        db.refresh(target_user)
        return {
            "message": f"User plan updated to {new_plan}",
            "user_id": target_user.id,
            "subscription_plan": target_user.subscription_plan,
            "storage_quota_limit": target_user.storage_quota_limit
        }
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error toggling user plan: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error toggling user plan: {str(exc)}"
        )

@router.put("/users/{id}/quota", status_code=status.HTTP_200_OK)
def update_user_quota(
    id: int,
    payload: QuotaUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Accepts new_quota_bytes and updates photographer's storage_quota_limit.
    """
    if payload.new_quota_bytes < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Storage quota cannot be negative."
        )

    target_user = db.query(User).filter(User.id == id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {id} not found."
        )

    try:
        target_user.storage_quota_limit = payload.new_quota_bytes
        db.commit()
        db.refresh(target_user)
        return {
            "message": "Storage quota updated successfully",
            "user_id": target_user.id,
            "new_quota_bytes": target_user.storage_quota_limit,
            "quota_gb": round(target_user.storage_quota_limit / (1024 * 1024 * 1024), 2)
        }
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating storage quota: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error updating storage quota: {str(exc)}"
        )

@router.post("/users/{id}/reset-password", status_code=status.HTTP_200_OK)
def reset_user_password(
    id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Emergency Password Reset for a Photographer account.
    Generates a fresh temporary password, updates the hash using PBKDF2,
    flags needs_password_change=True, and returns the plain-text password for the admin.
    """
    target_user = db.query(User).filter(User.id == id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {id} not found."
        )

    alphabet = string.ascii_letters + string.digits
    new_temp_password = "".join(secrets.choice(alphabet) for _ in range(8))
    
    try:
        target_user.hashed_password = get_password_hash(new_temp_password)
        target_user.needs_password_change = True
        target_user.is_active = True
        db.commit()
        db.refresh(target_user)
        return {
            "message": f"Password for {target_user.email} successfully reset.",
            "user_id": target_user.id,
            "email": target_user.email,
            "temp_password": new_temp_password
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset photographer password: {str(exc)}"
        )

