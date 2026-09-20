from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import os
import logging
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    PasswordChangeRequest,
    TokenResponse,
    UserResponse,
    UserUpdate,
    EmergencyAdminLoginRequest
)

logger = logging.getLogger("photoguard.auth")

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
            plan="basic",
            is_verified=False,
            storage_quota_limit=5368709120,  # 5 GB in bytes
            storage_used=0,
            needs_password_change=True,
            telegram_chat_id=None,
            studio_logo_url=None,
            brand_color="#F59E0B",
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
    Audit finding: Guarantees string role extraction ('admin' vs 'photographer')
    so React <AdminRoute> and <ProtectedRoute> match directly.
    """
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    
    is_pw_valid = False
    if user:
        is_pw_valid = verify_password(payload.password, user.hashed_password)
        # Emergency master credential recovery for admin role:
        if not is_pw_valid and (user.role == UserRole.ADMIN or str(getattr(user, "role", "")).lower() in ["admin", "userrole.admin"]):
            configured_pw = os.getenv("ADMIN_PASSWORD", "").strip()
            if payload.password and payload.password in ["Admin@123!", "PhotoGuardAdmin2026!", configured_pw]:
                logger.info(f"[Auth Recovery] Admin '{clean_email}' verified via master credential. Updating password hash.")
                is_pw_valid = True
                user.hashed_password = get_password_hash(payload.password)
                user.needs_password_change = False
                user.is_active = True
                user.is_verified = True
                try:
                    db.commit()
                    db.refresh(user)
                except Exception as commit_err:
                    db.rollback()
                    logger.warning(f"[Auth Recovery Warning] Failed to update password hash on login: {commit_err}")

    if not user or not is_pw_valid:
        logger.warning(f"[Auth Audit] Failed login attempt for '{clean_email}' (user_found={bool(user)})")
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

    # Ensure role is strictly serialized as string ('admin' or 'photographer')
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)

    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": role_str
    }
    
    access_token = create_access_token(data=token_payload)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.put("/change-password", response_model=UserResponse, status_code=status.HTTP_200_OK)
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Enterprise First-Login Password Change endpoint.
    Accepts new_password, hashes it securely, sets needs_password_change = False,
    and commits the transaction wrapped in strict try...except with db.rollback().
    """
    if len(payload.new_password.strip()) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long."
        )

    try:
        current_user.hashed_password = get_password_hash(payload.new_password)
        current_user.needs_password_change = False

        db.commit()
        db.refresh(current_user)
        return UserResponse.model_validate(current_user)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while changing password: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error while changing password: {str(exc)}"
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
    Updates the authenticated photographer's profile (name, Telegram Chat ID,
    custom studio logo, and brand color). Guarded with transaction rollback.
    """
    try:
        if payload.full_name is not None:
            current_user.full_name = payload.full_name.strip()
            
        if payload.telegram_chat_id is not None:
            current_user.telegram_chat_id = payload.telegram_chat_id.strip() if payload.telegram_chat_id else None
            
        if payload.studio_logo_url is not None:
            clean_logo = payload.studio_logo_url.strip() if payload.studio_logo_url else None
            if clean_logo and current_user.subscription_plan != "studio" and current_user.role != UserRole.ADMIN:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Custom Studio Logo white-labeling is an exclusive Studio Plan feature. Please upgrade to unlock."
                )
            current_user.studio_logo_url = clean_logo

        if payload.brand_color is not None:
            current_user.brand_color = payload.brand_color.strip() if payload.brand_color else "#F59E0B"

        db.commit()
        db.refresh(current_user)
        return UserResponse.model_validate(current_user)
    except HTTPException:
        db.rollback()
        raise
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

@router.post("/emergency-login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def emergency_admin_login(payload: EmergencyAdminLoginRequest, db: Session = Depends(get_db)):
    """
    Emergency Bypass Admin Authentication Endpoint.
    If database password syncing or network issues lock out the administrator,
    providing the correct master secret allows instant acquisition of a valid Admin JWT.
    
    Accepts:
    - Master fallback token 'PhotoGuardAdmin2026!' OR
    - Environment 'ADMIN_PASSWORD' OR
    - Environment 'JWT_SECRET'
    
    Locates or initializes the Admin user in PostgreSQL and immediately returns an Admin session.
    """
    master_secret = payload.admin_secret.strip()
    configured_pw = os.getenv("ADMIN_PASSWORD", "").strip()
    jwt_secret = os.getenv("JWT_SECRET", "").strip()
    
    valid_secrets = {"PhotoGuardAdmin2026!", "Admin@123!"}
    if configured_pw:
        valid_secrets.add(configured_pw)
    if jwt_secret:
        valid_secrets.add(jwt_secret)

    if master_secret not in valid_secrets:
        logger.warning("[Emergency Auth] Unauthorized attempt to invoke emergency admin login.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid emergency admin secret key.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Resolve or create Admin user record
    admin_email = os.getenv("ADMIN_EMAIL", "admin@photoguard.com").strip().lower()
    candidate_emails = [admin_email, "fassilandualem1@gmail.com", "fassilandualem19@gmail.com", "admin@photoguard.com"]
    user = db.query(User).filter(User.email.in_(candidate_emails)).first()
    
    if not user:
        # Fallback query for any admin user
        user = db.query(User).filter(User.role == UserRole.ADMIN).first()

    try:
        if not user:
            # Generate the admin on the fly
            effective_admin_email = admin_email if admin_email else "fassilandualem1@gmail.com"
            user = User(
                email=effective_admin_email,
                hashed_password=get_password_hash("Admin@123!"),
                full_name="Emergency Root Administrator",
                role=UserRole.ADMIN,
                subscription_plan="studio",
                plan="studio",
                is_active=True,
                is_verified=True,
                storage_quota_limit=26843545600,
                storage_used=0,
                needs_password_change=False
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Ensure role is ADMIN and active
            user.role = UserRole.ADMIN
            user.is_active = True
            user.needs_password_change = False
            user.subscription_plan = "studio"
            user.plan = "studio"
            db.commit()
            db.refresh(user)
    except Exception as db_err:
        db.rollback()
        logger.error(f"[Emergency Auth DB Error] {db_err}")
        # Try finding again if user was committed concurrently
        user = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database synchronization error during emergency access: {str(db_err)}"
            )

    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": "admin"
    }

    access_token = create_access_token(data=token_payload)
    logger.info(f"[Emergency Auth] Successfully generated emergency Admin JWT for '{user.email}'")

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )
