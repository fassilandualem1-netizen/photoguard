from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.models.user import User, UserRole
from app.models.album import Album, MediaItem
from app.schemas.auth import UserResponse
from app.schemas.admin import PlatformStatsResponse, AdminUserUpdateRequest

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Control"])

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
        total_photographers = db.query(func.count(User.id)).filter(User.role == UserRole.PHOTOGRAPHER).scalar() or 0
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

@router.put("/users/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_user_status(
    user_id: int,
    payload: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Allows Admin to update photographer monetization status:
    - subscription_plan ("basic" or "studio")
    - verify accounts (is_verified = True)
    - suspend bad actors (is_active = False)
    - adjust custom storage quota limits
    Wrapped in strict try...except with db.rollback().
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found."
        )

    # Validate subscription plan if provided
    if payload.subscription_plan is not None:
        clean_plan = payload.subscription_plan.strip().lower()
        if clean_plan not in ["basic", "studio"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid subscription plan. Allowed tiers: 'basic' or 'studio'."
            )
        target_user.subscription_plan = clean_plan

    try:
        if payload.is_verified is not None:
            target_user.is_verified = payload.is_verified

        if payload.is_active is not None:
            target_user.is_active = payload.is_active

        if payload.storage_quota_limit is not None:
            if payload.storage_quota_limit < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Storage quota limit cannot be negative."
                )
            target_user.storage_quota_limit = payload.storage_quota_limit

        db.commit()
        db.refresh(target_user)
        return UserResponse.model_validate(target_user)

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating user status: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error updating user status: {str(exc)}"
        )
