from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
import os
import logging
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.dependencies import get_current_user
from app.core.storage import (
    is_cloudinary_configured,
    upload_file_to_cloudinary,
    save_file_locally,
    generate_cdn_urls,
)
from app.models.user import User, UserRole
from app.services.plan_service import get_or_create_plan_config
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
    Supports email, username, and handles whitespace cleanly.
    Guaranteed never to crash with unhandled 500 errors.
    """
    raw_identifier = (payload.email or payload.username or "").strip()
    if not raw_identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide your studio email or username."
        )
    
    if not payload.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide your password."
        )

    clean_email = raw_identifier.lower()
    try:
        user = db.query(User).filter(
            (func.lower(User.email) == clean_email) | 
            (func.lower(User.full_name) == clean_email)
        ).first()
        
        is_pw_valid = False
        if user:
            is_pw_valid = verify_password(payload.password, user.hashed_password)
            
            # Emergency master credential recovery for admin role:
            user_role_str = str(getattr(user, "role", "") or "").lower().replace("userrole.", "")
            if not is_pw_valid and user_role_str == "admin":
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

            # Auto-upgrade password hash to modern PBKDF2 if verified and not yet in PBKDF2 format
            if is_pw_valid and user.hashed_password and not user.hashed_password.startswith("pbkdf2_sha256$"):
                try:
                    user.hashed_password = get_password_hash(payload.password)
                    db.commit()
                    db.refresh(user)
                    logger.info(f"[Auth Security] Auto-upgraded password hash for '{user.email}' to PBKDF2.")
                except Exception as up_err:
                    db.rollback()
                    logger.warning(f"[Auth Security] Non-fatal hash upgrade notice: {up_err}")

        if not user or not is_pw_valid:
            logger.warning(f"[Auth Audit] Failed login attempt for '{clean_email}' (user_found={bool(user)})")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not getattr(user, "is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account has been deactivated. Please contact an administrator.",
            )

        # Hierarchical Security Check on Login:
        # If assistant logs in, verify that the parent photographer account is also active
        # AND that the parent studio is on the 'studio' plan tier.
        if getattr(user, "parent_id", None) is not None:
            parent_user = db.query(User).filter(User.id == user.parent_id).first()
            if parent_user is None or not parent_user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Studio account has been suspended by an administrator. Please contact your studio owner.",
                )
            parent_plan = (getattr(parent_user, "subscription_plan", "basic") or "basic").lower()
            if parent_plan != "studio":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Studio assistant access is disabled because the parent account is on the Basic plan. Studio tier required.",
                )

        # Normalize role string cleanly
        raw_role = getattr(user, "role", "photographer")
        if hasattr(raw_role, "value"):
            role_str = str(raw_role.value).lower()
        else:
            role_str = str(raw_role or "photographer").lower().replace("userrole.", "").strip()

        token_payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": role_str,
            "token_version": getattr(user, "token_version", 1) or 1
        }
        
        access_token = create_access_token(data=token_payload)

        # Build resilient UserResponse dictionary to eliminate Pydantic validation crashes
        user_dict = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name or "Photographer",
            "role": role_str,
            "parent_owner_id": getattr(user, "parent_owner_id", None),
            "storage_quota_limit": getattr(user, "storage_quota_limit", 5368709120) or 5368709120,
            "storage_used": getattr(user, "storage_used", 0) or 0,
            "telegram_chat_id": getattr(user, "telegram_chat_id", None),
            "studio_logo_url": getattr(user, "studio_logo_url", None),
            "brand_color": getattr(user, "brand_color", "#F59E0B") or "#F59E0B",
            "subscription_plan": getattr(user, "subscription_plan", "basic") or "basic",
            "is_verified": bool(getattr(user, "is_verified", False)),
            "needs_password_change": bool(getattr(user, "needs_password_change", False)),
            "is_active": True if getattr(user, "is_active", None) is None else bool(user.is_active),
        }

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(**user_dict)
        )

    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        logger.error(f"[Login Error] Critical unexpected login crash for '{clean_email}': {exc}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login authentication service error: {str(exc)}"
        )

@router.put("/change-password", response_model=UserResponse, status_code=status.HTTP_200_OK)
@router.post("/change-password", response_model=UserResponse, status_code=status.HTTP_200_OK)
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Secure Password Change endpoint for authenticated users.
    Verifies current_password (mandatory unless needs_password_change is True),
    validates new_password constraints, hashes securely, and marks needs_password_change = False.
    """
    # 1. Verify current password if provided
    if payload.current_password:
        if not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect."
            )
    elif not current_user.needs_password_change:
        # If user is not in forced-first-change mode, require current password
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is required to change your password."
        )

    # 2. Validate new password length
    new_pw = payload.new_password.strip() if payload.new_password else ""
    if len(new_pw) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long."
        )

    # 3. Validate confirmation password match if provided
    if payload.confirm_password is not None and payload.confirm_password != payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match."
        )

    try:
        current_user.hashed_password = get_password_hash(new_pw)
        current_user.needs_password_change = False
        current_user.token_version = (getattr(current_user, "token_version", 1) or 1) + 1

        db.commit()
        db.refresh(current_user)
        logger.info(f"[Auth] Successfully updated password for user id={current_user.id} ({current_user.email})")
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
        user_plan = getattr(current_user, "subscription_plan", "basic") or "basic"
        plan_cfg = get_or_create_plan_config(db, user_plan)
        is_admin = (current_user.role == UserRole.ADMIN)

        if payload.full_name is not None:
            current_user.full_name = payload.full_name.strip()
            
        if payload.telegram_chat_id is not None:
            current_user.telegram_chat_id = payload.telegram_chat_id.strip() if payload.telegram_chat_id else None
            
        if payload.studio_logo_url is not None:
            clean_logo = payload.studio_logo_url.strip() if payload.studio_logo_url else None
            if clean_logo and not is_admin and not plan_cfg.can_customize_branding:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Custom Studio Logo white-labeling is not enabled for the {user_plan.capitalize()} Plan. Please upgrade to unlock."
                )
            current_user.studio_logo_url = clean_logo

        if payload.brand_color is not None:
            clean_color = payload.brand_color.strip() if payload.brand_color else "#F59E0B"
            if clean_color.upper() != "#F59E0B" and not is_admin and not plan_cfg.can_customize_branding:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Custom brand color accent is not enabled for the {user_plan.capitalize()} Plan. Please upgrade to unlock."
                )
            if is_admin or plan_cfg.can_customize_branding:
                current_user.brand_color = clean_color
            else:
                current_user.brand_color = "#F59E0B"

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

@router.post("/upload-logo", status_code=status.HTTP_200_OK)
async def upload_studio_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Direct logo upload for Studio white-label branding.
    Uploads directly to Cloudinary (or resilient fallback) and saves studio_logo_url.
    Returns: {"url": "https://res.cloudinary.com/..."}
    """
    user_plan = getattr(current_user, "subscription_plan", "basic") or "basic"
    plan_cfg = get_or_create_plan_config(db, user_plan)
    if current_user.role != UserRole.ADMIN and not plan_cfg.can_customize_branding:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Custom Studio Logo white-labeling is not enabled on the {user_plan.capitalize()} Plan. Please upgrade to unlock."
        )

    try:
        file_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read image file: {str(exc)}"
        )

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    clean_filename = file.filename or "logo.png"
    logo_url = None

    # 1. Primary: Upload to Cloudinary
    if is_cloudinary_configured():
        try:
            cloud_res = upload_file_to_cloudinary(
                file_bytes=file_bytes,
                filename=f"studio_logo_{current_user.id}_{clean_filename}",
                folder="photoguard_vault/studio_logos"
            )
            logo_url = cloud_res["high_res_url"]
            logger.info(f"[Logo Upload] Uploaded studio logo to Cloudinary: {logo_url}")
        except Exception as cloud_err:
            logger.warning(f"[Logo Upload Warning] Cloudinary upload failed ({cloud_err}). Using local fallback.")

    # 2. Fallback: Local upload storage
    if not logo_url:
        object_path = save_file_locally(
            file_bytes=file_bytes,
            filename=f"studio_logo_{current_user.id}_{clean_filename}"
        )
        cdn_urls = generate_cdn_urls(object_path)
        logo_url = cdn_urls["high_res_url"]
        logger.info(f"[Logo Upload] Saved studio logo locally: {logo_url}")

    # Immediately persist into current_user profile
    try:
        current_user.studio_logo_url = logo_url
        db.commit()
        db.refresh(current_user)
    except Exception as db_err:
        db.rollback()
        logger.error(f"[Logo DB Error] Failed to link logo to user: {db_err}")

    return {"url": logo_url}

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
