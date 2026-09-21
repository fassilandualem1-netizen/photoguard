import secrets
import string
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.schemas.team import TeamMemberCreate, TeamMemberResponse

logger = logging.getLogger("photoguard.team")

router = APIRouter(prefix="/api/v1/team", tags=["Team Management"])

def generate_secure_temp_password(length: int = 10) -> str:
    """Generates an easy-to-read, secure temporary password for assistant onboarding."""
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))

def require_studio_owner(user: User):
    """
    Enforces Studio plan and owner role for team administration.
    Assistants cannot manage team members.
    """
    if user.role == UserRole.ASSISTANT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Assistants do not have permissions to manage team members."
        )
    if user.role != UserRole.ADMIN and user.subscription_plan != "studio":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team Management is an exclusive Studio Plan feature. Please upgrade your plan to add assistants."
        )

@router.get("", response_model=List[TeamMemberResponse], status_code=status.HTTP_200_OK)
def list_team_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists all assistants belonging to the current studio owner.
    """
    require_studio_owner(current_user)

    if current_user.role == UserRole.ADMIN:
        members = db.query(User).filter(User.role == UserRole.ASSISTANT).order_by(User.created_at.desc()).all()
    else:
        members = db.query(User).filter(
            User.parent_owner_id == current_user.id,
            User.role == UserRole.ASSISTANT
        ).order_by(User.created_at.desc()).all()

    return [
        TeamMemberResponse(
            id=m.id,
            full_name=m.full_name,
            email=m.email,
            role=str(m.role.value if hasattr(m.role, "value") else m.role),
            parent_owner_id=m.parent_owner_id,
            is_active=bool(m.is_active),
            created_at=m.created_at,
            temp_password=None
        )
        for m in members
    ]

@router.post("", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def create_team_member(
    payload: TeamMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new Assistant account under the authenticated Studio Owner.
    Assistants can upload raw photos, monitor client selections, and upload final deliverables.
    Assistants cannot delete albums, delete photos, or access owner billing/security settings.
    """
    require_studio_owner(current_user)

    clean_email = payload.email.strip().lower()
    clean_name = payload.full_name.strip()

    # Check email conflict
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists in PhotoGuard."
        )

    # Password assignment
    raw_password = payload.password.strip() if payload.password else generate_secure_temp_password()
    if len(raw_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    try:
        new_assistant = User(
            email=clean_email,
            hashed_password=get_password_hash(raw_password),
            full_name=clean_name,
            role=UserRole.ASSISTANT,
            parent_owner_id=current_user.id,
            subscription_plan=current_user.subscription_plan or "studio",
            plan=current_user.subscription_plan or "studio",
            is_verified=True,
            is_active=True,
            needs_password_change=False,
            brand_color=current_user.brand_color or "#F59E0B",
            studio_logo_url=current_user.studio_logo_url,
            storage_quota_limit=current_user.storage_quota_limit,
            storage_used=0
        )

        db.add(new_assistant)
        db.commit()
        db.refresh(new_assistant)

        logger.info(f"[Team] Studio owner id={current_user.id} created assistant id={new_assistant.id} ({new_assistant.email})")

        return TeamMemberResponse(
            id=new_assistant.id,
            full_name=new_assistant.full_name,
            email=new_assistant.email,
            role="assistant",
            parent_owner_id=new_assistant.parent_owner_id,
            is_active=new_assistant.is_active,
            created_at=new_assistant.created_at,
            temp_password=raw_password
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"[Team] Database error creating assistant: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while creating assistant: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Team] Unexpected error creating assistant: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error while creating assistant: {str(exc)}"
        )

@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deactivates or removes an assistant from the Studio Owner's team.
    """
    require_studio_owner(current_user)

    query = db.query(User).filter(User.id == member_id, User.role == UserRole.ASSISTANT)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(User.parent_owner_id == current_user.id)

    member = query.first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant team member not found or does not belong to your studio."
        )

    try:
        db.delete(member)
        db.commit()
        logger.info(f"[Team] Removed assistant id={member_id} by owner id={current_user.id}")
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete team member: {str(exc)}"
        )
