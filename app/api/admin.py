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
from app.models.plan_config import PlanConfiguration
from app.models.audit import AuditLog
from app.services.plan_service import get_or_create_plan_config, get_all_plan_configs
from app.schemas.admin import (
    PlanConfigResponse,
    PlanConfigUpdateRequest,
)

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Control"])

# Pydantic Schemas for Admin API requests & responses
class AuditLogResponse(BaseModel):
    id: int
    admin_id: int
    admin_email: Optional[str] = None
    action: str
    target_user_id: Optional[int] = None
    target_user_email: Optional[str] = None
    details: str
    created_at: str

    class Config:
        from_attributes = True

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
    parent_id: Optional[int] = None
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
                    parent_id=p.parent_id,
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

    # Dynamic plan quota from PlanConfiguration
    plan_cfg = get_or_create_plan_config(db, plan)
    default_quota = plan_cfg.storage_quota_bytes

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
        new_active_status = not target_user.is_active
        target_user.is_active = new_active_status
        action_state = "ACTIVATED" if target_user.is_active else "SUSPENDED"

        # CASCADE SUSPENSION:
        # If target_user is a parent studio/photographer, cascade the new is_active status
        # to all assistant/staff sub-accounts directly linked via parent_id.
        cascaded_count = 0
        if not target_user.parent_id and (target_user.role == UserRole.PHOTOGRAPHER.value or target_user.role == UserRole.PHOTOGRAPHER or target_user.role == "photographer" or target_user.role == "owner"):
            assistants = db.query(User).filter(User.parent_id == target_user.id).all()
            for assistant in assistants:
                assistant.is_active = new_active_status
                cascaded_count += 1

        cascade_msg = f" (Cascade applied to {cascaded_count} assistants)" if cascaded_count > 0 else ""
        
        # Inject Security Audit Log
        audit_entry = AuditLog(
            admin_id=admin_user.id,
            action="SUSPEND_USER",
            target_user_id=target_user.id,
            details=f"Admin {admin_user.email} changed status of user {target_user.email} (ID #{target_user.id}) to {action_state}.{cascade_msg}"
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(target_user)
        return {
            "message": f"User is now {'active' if target_user.is_active else 'suspended'}{cascade_msg}",
            "user_id": target_user.id,
            "is_active": target_user.is_active,
            "cascaded_count": cascaded_count
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
        current_plan_str = target_user.subscription_plan or "basic"
        new_plan = "studio" if current_plan_str == "basic" else "basic"
        old_cfg = get_or_create_plan_config(db, current_plan_str)
        new_cfg = get_or_create_plan_config(db, new_plan)

        target_user.subscription_plan = new_plan
        target_user.plan = new_plan

        # If photographer had the standard quota of their old plan, transition them to the new plan's dynamic quota
        if target_user.storage_quota_limit == old_cfg.storage_quota_bytes:
            target_user.storage_quota_limit = new_cfg.storage_quota_bytes

        # Strict Dynamic Tier Gate: If new plan does not support custom branding, wipe branding assets
        if not new_cfg.can_customize_branding:
            target_user.studio_logo_url = None
            target_user.brand_color = "#F59E0B"

        # Inject Security Audit Log
        audit_entry = AuditLog(
            admin_id=admin_user.id,
            action="TOGGLE_PLAN",
            target_user_id=target_user.id,
            details=f"Admin {admin_user.email} changed plan of user {target_user.email} (ID #{target_user.id}) from '{current_plan_str}' to '{new_plan}'."
        )
        db.add(audit_entry)

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

        # Inject Security Audit Log
        audit_entry = AuditLog(
            admin_id=admin_user.id,
            action="RESET_PASSWORD",
            target_user_id=target_user.id,
            details=f"Admin {admin_user.email} initiated emergency password reset for user {target_user.email} (ID #{target_user.id})."
        )
        db.add(audit_entry)

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

def format_plan_response(cfg: PlanConfiguration) -> PlanConfigResponse:
    quota_bytes = cfg.storage_quota_bytes or 0
    quota_gb = round(quota_bytes / (1024 * 1024 * 1024), 2)
    return PlanConfigResponse(
        id=cfg.id,
        plan_name=cfg.plan_name,
        storage_quota_bytes=quota_bytes,
        storage_quota_gb=quota_gb,
        default_lifespan_days=cfg.default_lifespan_days,
        max_lifespan_days=cfg.max_lifespan_days,
        can_enable_downloads=bool(cfg.can_enable_downloads),
        can_customize_branding=bool(cfg.can_customize_branding),
        can_extend_lifespan=bool(cfg.can_extend_lifespan),
        updated_at=cfg.updated_at
    )

@router.get("/plans", response_model=List[PlanConfigResponse], status_code=status.HTTP_200_OK)
def get_dynamic_plans(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Returns the dynamic system configurations for all subscription tiers (Basic, Studio).
    """
    configs = get_all_plan_configs(db)
    return [format_plan_response(c) for c in configs]

@router.put("/plans/{plan_name}", response_model=PlanConfigResponse, status_code=status.HTTP_200_OK)
def update_dynamic_plan(
    plan_name: str,
    payload: PlanConfigUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Allows the Admin to dynamically reconfigure limits, lifespans, and feature flags
    for 'basic' or 'studio' plans without code deployment.
    """
    normalized = plan_name.lower().strip()
    if normalized not in ["basic", "studio"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan name '{plan_name}'. Must be 'basic' or 'studio'."
        )

    cfg = get_or_create_plan_config(db, normalized)

    try:
        if payload.storage_quota_bytes is not None:
            cfg.storage_quota_bytes = payload.storage_quota_bytes
        if payload.default_lifespan_days is not None:
            cfg.default_lifespan_days = payload.default_lifespan_days
        if payload.max_lifespan_days is not None:
            cfg.max_lifespan_days = payload.max_lifespan_days
        if payload.can_enable_downloads is not None:
            cfg.can_enable_downloads = payload.can_enable_downloads
        if payload.can_customize_branding is not None:
            cfg.can_customize_branding = payload.can_customize_branding
        if payload.can_extend_lifespan is not None:
            cfg.can_extend_lifespan = payload.can_extend_lifespan

        # Validation: default lifespan cannot exceed max lifespan
        if cfg.default_lifespan_days > cfg.max_lifespan_days:
            cfg.max_lifespan_days = cfg.default_lifespan_days

        db.commit()
        db.refresh(cfg)
        return format_plan_response(cfg)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating plan configuration: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update plan configuration: {str(exc)}"
        )


@router.get("/audit-logs", response_model=List[AuditLogResponse], status_code=status.HTTP_200_OK)
def get_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Returns the latest 50 security audit logs, ordered by created_at desc.
    Enriched with admin_email and target_user_email for presentation clarity.
    """
    try:
        limit_val = min(max(1, limit), 100)
        logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit_val).all()
        
        # Batch gather user emails to avoid N+1 queries
        user_ids = set()
        for log in logs:
            if log.admin_id:
                user_ids.add(log.admin_id)
            if log.target_user_id:
                user_ids.add(log.target_user_id)

        user_map = {}
        if user_ids:
            users = db.query(User.id, User.email).filter(User.id.in_(user_ids)).all()
            user_map = {u[0]: u[1] for u in users}

        response: List[AuditLogResponse] = []
        for log in logs:
            response.append(
                AuditLogResponse(
                    id=log.id,
                    admin_id=log.admin_id,
                    admin_email=user_map.get(log.admin_id),
                    action=log.action,
                    target_user_id=log.target_user_id,
                    target_user_email=user_map.get(log.target_user_id) if log.target_user_id else None,
                    details=log.details,
                    created_at=log.created_at.isoformat() if log.created_at else ""
                )
            )
        return response
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error fetching audit logs: {str(exc)}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error fetching audit logs: {str(exc)}"
        )


