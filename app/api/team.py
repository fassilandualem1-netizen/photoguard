import secrets
import string
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole

logger = logging.getLogger("photoguard.team")

router = APIRouter(prefix="/api/v1/team", tags=["Team Management"])

# Pydantic Schemas for Team Management
class AssistantCreateRequest(BaseModel):
    email: EmailStr
    full_name: str

class AssistantResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class AssistantCreatedResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool
    temporary_password: str
    created_at: Optional[str] = None


@router.post("/", response_model=AssistantCreatedResponse, status_code=status.HTTP_201_CREATED)
def add_assistant(
    payload: AssistantCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new studio assistant sub-account under the authenticated photographer.
    Strict Studio Tier Gate: Only photographers on the 'studio' plan (or admin) can create assistants.
    Limit Check: Maximum of 5 assistants per studio.
    Generates a secure 8-character password and marks needs_password_change=True.
    """
    user_plan = getattr(current_user, "subscription_plan", "basic") or "basic"
    is_admin = (current_user.role == UserRole.ADMIN.value or current_user.role == UserRole.ADMIN)

    # 1. Strict Studio Tier Gate
    if not is_admin and user_plan != "studio":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Studio Assistants is an exclusive Studio Plan feature. Please upgrade your subscription to unlock team accounts."
        )

    clean_email = payload.email.strip().lower()
    clean_name = payload.full_name.strip()

    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required."
        )

    try:
        # 2. Limit Check: Maximum 5 assistants
        assistant_count = db.query(User).filter(User.parent_id == current_user.id).count()
        if assistant_count >= 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum of 5 assistants allowed per studio account."
            )

        # 3. Check for email conflict across all users
        existing_user = db.query(User).filter(User.email == clean_email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An account with email '{clean_email}' already exists."
            )

        # 4. Generate random 8-character secure password
        alphabet = string.ascii_letters + string.digits
        temp_password = "".join(secrets.choice(alphabet) for _ in range(8))
        hashed_pw = get_password_hash(temp_password)

        new_assistant = User(
            email=clean_email,
            hashed_password=hashed_pw,
            full_name=clean_name,
            role=UserRole.ASSISTANT.value,
            parent_id=current_user.id,
            subscription_plan=current_user.subscription_plan or "studio",
            plan=current_user.plan or "studio",
            is_verified=True,
            is_active=True,
            storage_quota_limit=0,  # Storage is attributed directly to parent via effective_owner_id
            storage_used=0,
            needs_password_change=True
        )

        db.add(new_assistant)
        db.commit()
        db.refresh(new_assistant)

        logger.info(f"[Team Management] Assistant '{new_assistant.email}' created under photographer #{current_user.id}.")

        return AssistantCreatedResponse(
            id=new_assistant.id,
            full_name=new_assistant.full_name,
            email=new_assistant.email,
            is_active=new_assistant.is_active,
            temporary_password=temp_password,
            created_at=new_assistant.created_at.isoformat() if new_assistant.created_at else None
        )

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"[Team Management Error] Database error adding assistant: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error creating assistant: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Team Management Error] Unexpected error adding assistant: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error creating assistant: {str(exc)}"
        )


@router.get("/", response_model=List[AssistantResponse], status_code=status.HTTP_200_OK)
def list_assistants(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the list of all assistants belonging to the current photographer's studio.
    Password hashes are omitted.
    """
    try:
        assistants = (
            db.query(User)
            .filter(User.parent_id == current_user.id)
            .order_by(User.created_at.desc())
            .all()
        )

        result = []
        for asst in assistants:
            result.append(
                AssistantResponse(
                    id=asst.id,
                    full_name=asst.full_name,
                    email=asst.email,
                    is_active=asst.is_active,
                    created_at=asst.created_at.isoformat() if asst.created_at else None
                )
            )
        return result

    except SQLAlchemyError as exc:
        logger.error(f"[Team Management Error] Database error listing assistants: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error fetching team members: {str(exc)}"
        )


@router.delete("/{assistant_id}", status_code=status.HTTP_200_OK)
def remove_assistant(
    assistant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Removes an assistant from the photographer's team.
    Ensures the target assistant strictly belongs to the current photographer (parent_id == current_user.id).
    Hard-deletes the assistant record safely.
    """
    try:
        assistant = (
            db.query(User)
            .filter(User.id == assistant_id, User.parent_id == current_user.id)
            .first()
        )

        if not assistant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assistant #{assistant_id} not found in your team."
            )

        deleted_email = assistant.email
        db.delete(assistant)
        db.commit()

        logger.info(f"[Team Management] Photographer #{current_user.id} removed assistant #{assistant_id} ({deleted_email}).")
        return {"detail": f"Assistant '{deleted_email}' successfully removed from your team."}

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"[Team Management Error] Database error deleting assistant #{assistant_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error removing assistant: {str(exc)}"
        )
