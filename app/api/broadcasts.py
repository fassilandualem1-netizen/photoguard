import logging
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.broadcast import Broadcast
from app.models.audit import AuditLog


logger = logging.getLogger("photoguard.broadcasts")

router = APIRouter(tags=["Broadcasts"])

# Pydantic Schemas
class BroadcastCreateRequest(BaseModel):
    title: str
    message: str
    type: str = "info"  # 'info', 'warning', 'promo'

class BroadcastResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency ensuring caller has ADMIN privileges."""
    user_role = str(current_user.role).lower()
    if user_role not in (UserRole.ADMIN.value, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to manage broadcasts."
        )
    return current_user


# 1. GET /api/v1/broadcasts/active: Returns the most recent is_active=True broadcast.
@router.get("/api/v1/broadcasts/active", response_model=Optional[BroadcastResponse], status_code=status.HTTP_200_OK)
@router.get("/api/v1/broadcasts/active/", response_model=Optional[BroadcastResponse], status_code=status.HTTP_200_OK)
def get_active_broadcast(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the most recent active broadcast for authenticated photographers/users.
    Returns None if no active announcements exist.
    """
    try:
        broadcast = (
            db.query(Broadcast)
            .filter(Broadcast.is_active == True)
            .order_by(Broadcast.created_at.desc())
            .first()
        )
        return broadcast
    except SQLAlchemyError as exc:
        logger.error(f"[Broadcast Error] Database error fetching active broadcast: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve active broadcast announcement."
        )


# 2. POST /api/v1/admin/broadcasts: Admin-only route to create a new broadcast.
@router.post("/api/v1/admin/broadcasts", response_model=BroadcastResponse, status_code=status.HTTP_201_CREATED)
@router.post("/api/v1/admin/broadcasts/", response_model=BroadcastResponse, status_code=status.HTTP_201_CREATED)
def create_broadcast(
    payload: BroadcastCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Creates a new global broadcast announcement.
    Automatically deactivates all previous broadcasts so only one announcement is active at a time.
    """
    clean_title = payload.title.strip()
    clean_message = payload.message.strip()
    broadcast_type = payload.type.strip().lower()

    if not clean_title or not clean_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title and message cannot be empty."
        )

    if broadcast_type not in ("info", "warning", "promo"):
        broadcast_type = "info"

    try:
        # Atomic transition: Set all active broadcasts to inactive
        db.query(Broadcast).filter(Broadcast.is_active == True).update({"is_active": False})

        new_broadcast = Broadcast(
            title=clean_title,
            message=clean_message,
            type=broadcast_type,
            is_active=True
        )
        db.add(new_broadcast)

        # Inject Security Audit Log
        audit_entry = AuditLog(
            admin_id=admin.id,
            action="BROADCAST_PUBLISHED",
            target_user_id=None,
            details=f"Admin {admin.email} published broadcast announcement '{new_broadcast.title}' ({new_broadcast.type})."
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(new_broadcast)

        logger.info(f"[Broadcast] Admin #{admin.id} published new broadcast #{new_broadcast.id}: '{new_broadcast.title}'")
        return new_broadcast

    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"[Broadcast Error] Failed to publish broadcast: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error creating broadcast: {str(exc)}"
        )


# 3. PUT /api/v1/admin/broadcasts/{id}/deactivate: Admin-only route to deactivate a specific broadcast.
@router.put("/api/v1/admin/broadcasts/{broadcast_id}/deactivate", response_model=BroadcastResponse, status_code=status.HTTP_200_OK)
@router.put("/api/v1/admin/broadcasts/{broadcast_id}/deactivate/", response_model=BroadcastResponse, status_code=status.HTTP_200_OK)
def deactivate_broadcast(
    broadcast_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Deactivates an active broadcast announcement.
    """
    try:
        broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
        if not broadcast:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Broadcast #{broadcast_id} not found."
            )

        broadcast.is_active = False
        db.commit()
        db.refresh(broadcast)

        logger.info(f"[Broadcast] Admin #{admin.id} deactivated broadcast #{broadcast_id}")
        return broadcast

    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"[Broadcast Error] Failed to deactivate broadcast: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error deactivating broadcast."
        )


# 4. GET /api/v1/admin/broadcasts: Admin-only route to list all broadcasts history.
@router.get("/api/v1/admin/broadcasts", response_model=List[BroadcastResponse], status_code=status.HTTP_200_OK)
@router.get("/api/v1/admin/broadcasts/", response_model=List[BroadcastResponse], status_code=status.HTTP_200_OK)
def list_all_broadcasts(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Returns full history of broadcast announcements for Admin review.
    """
    try:
        return db.query(Broadcast).order_by(Broadcast.created_at.desc()).all()
    except SQLAlchemyError as exc:
        logger.error(f"[Broadcast Error] Failed to list broadcasts: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error listing broadcasts."
        )
