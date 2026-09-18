from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse, UserUpdate

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registration endpoint for photographers joining PhotoGuard.
    Creates a basic tier photographer account with standard 5GB quota.
    Protected with robust transaction rollback error handling.
    """
    clean_email = payload.email.strip().lower()
    
    try:
        existing_user = db.query(User).filter(User.email == clean_email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists."
            )

        new_user = User(
            email=clean_email,
            hashed_password=get_password_hash(payload.password),
            full_name=payload.full_name.strip(),
            role=UserRole.PHOTOGRAPHER,
            subscription_plan="basic",
            is_verified=False,
            storage_quota_limit=5368709120, # 5 GB in bytes
            storage_used=0,
            telegram_chat_id=None,
            is_active=True
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return UserResponse.model_validate(new_user)

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during user registration: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during registration: {str(exc)}"
        )

@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Unified Login endpoint for PhotoGuard.
    Validates credentials against PostgreSQL and generates a secure JWT
    encapsulating subject ID, email, and system role.
    """
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact an administrator.",
        )

    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value
    }
    
    access_token = create_access_token(data=token_payload)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_authenticated_profile(current_user: User = Depends(get_current_user)):
    """
    Fetches the authenticated user profile using the validated JWT session.
    """
    return UserResponse.model_validate(current_user)

@router.put("/profile", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates the authenticated photographer's profile (name and Telegram Chat ID).
    Guarded with transaction rollback.
    """
    try:
        if payload.full_name is not None:
            current_user.full_name = payload.full_name.strip()
        if payload.telegram_chat_id is not None:
            current_user.telegram_chat_id = payload.telegram_chat_id.strip() if payload.telegram_chat_id else None

        db.commit()
        db.refresh(current_user)
        return UserResponse.model_validate(current_user)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating profile: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error updating profile: {str(exc)}"
        )
