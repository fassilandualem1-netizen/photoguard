from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, UserUpdate

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Unified Login endpoint for PhotoGuard.
    Validates credentials against PostgreSQL and generates a secure JWT
    encapsulating subject ID, email, and system role.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    
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
    """
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.telegram_chat_id is not None:
        current_user.telegram_chat_id = payload.telegram_chat_id.strip() if payload.telegram_chat_id else None

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)
