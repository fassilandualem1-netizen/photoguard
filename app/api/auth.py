import logging
import os
import traceback
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.client import get_client_ip
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.redis import (
    check_login_rate_limit,
    record_failed_login_attempt,
    reset_login_rate_limit,
)
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.storage import is_cloudinary_configured, upload_file_to_cloudinary
from app.models.audit import AuditLog
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserUpdate,
)
from app.services.plan_service import get_or_create_plan_config

logger = logging.getLogger("photoguard.auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

MAX_LOGO_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}


def _normalize_role(raw_role) -> str:
    if hasattr(raw_role, "value"):
        return str(raw_role.value).lower()
    return str(raw_role or "photographer").lower().replace("userrole.", "").strip()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registration endpoint for photographers joining PhotoGuard.
    Creates a basic tier photographer account with standard 5GB quota.
    """
    clean_email = payload.email.strip().lower()

    try:
        existing_user = db.query(User).filter(func.lower(User.email) == clean_email).first()
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
            needs_password_change=False,
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
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during user registration: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[Unexpected Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during registration: {req_id}"
        )


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Unified Login endpoint for PhotoGuard.
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
    client_ip = get_client_ip(request)

    is_limited, retry_after = check_login_rate_limit(
        client_ip=client_ip, email=clean_email, max_attempts=5, window_seconds=900
    )
    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please try again in {retry_after} seconds."
        )

    try:
        user = db.query(User).filter(func.lower(User.email) == clean_email).first()

        is_pw_valid = False
        if user:
            is_pw_valid = verify_password(payload.password, user.hashed_password)

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
            record_failed_login_attempt(client_ip=client_ip, email=clean_email, window_seconds=900)
            logger.warning(f"[Auth Audit] Failed login attempt for '{clean_email}' (user_found={bool(user)})")
            try:
                db.add(AuditLog(
                    admin_id=user.id if user else None,
                    action="LOGIN_FAILURE",
                    target_user_id=user.id if user else None,
                    details={"email": clean_email, "ip": client_ip, "reason": "invalid_credentials"}
                ))
                db.commit()
            except Exception:
                db.rollback()
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

        reset_login_rate_limit(client_ip=client_ip, email=clean_email)

        parent_id = getattr(user, "parent_id", None) or getattr(user, "parent_owner_id", None)
        if parent_id is not None:
            parent_user = db.query(User).filter(User.id == parent_id).first()
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

        role_str = _normalize_role(getattr(user, "role", "photographer"))

        token_payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": role_str,
            "token_version": getattr(user, "token_version", 1) or 1
        }
        access_token = create_access_token(data=token_payload)

        user_dict = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name or "Photographer",
            "role": role_str,
            "parent_owner_id": parent_id,
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

        is_prod = os.environ.get("ENVIRONMENT", "development") == "production"
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=is_prod,
            samesite="lax",
            max_age=86400
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(**user_dict)
        )

    except HTTPException:
        raise
    except Exception as exc:
        req_id = uuid.uuid4().hex
        logger.error(f"[Login Error {req_id}] Critical crash for '{clean_email}': {exc}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login authentication service error: {req_id}"
        )


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response):
    is_prod = os.environ.get("ENVIRONMENT", "development") == "production"
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=is_prod,
        samesite="lax"
    )
    return {"message": "Successfully logged out."}


@router.put("/change-password", response_model=UserResponse, status_code=status.HTTP_200_OK)
@router.post("/change-password", response_model=UserResponse, status_code=status.HTTP_200_OK)
def change_password(
    payload: PasswordChangeRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.current_password:
        if not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect."
            )
    elif not current_user.needs_password_change:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is required to change your password."
        )

    new_pw = payload.new_password.strip() if payload.new_password else ""
    if len(new_pw) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long."
        )

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
        logger.info(f"[Auth] Updated password for user id={current_user.id} ({current_user.email})")

        role_str = _normalize_role(getattr(current_user, "role", "photographer"))
        token_payload = {
            "sub": str(current_user.id),
            "email": current_user.email,
            "role": role_str,
            "token_version": current_user.token_version
        }
        access_token = create_access_token(data=token_payload)
        is_prod = os.environ.get("ENVIRONMENT", "development") == "production"
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=is_prod,
            samesite="lax",
            max_age=86400
        )

        return UserResponse.model_validate(current_user)
    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while changing password: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[Unexpected Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error while changing password: {req_id}"
        )


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_authenticated_profile(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.put("/profile", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        user_plan = getattr(current_user, "subscription_plan", "basic") or "basic"
        plan_cfg = get_or_create_plan_config(db, user_plan)
        is_admin = (current_user.role == UserRole.ADMIN)

        if payload.full_name is not None:
            current_user.full_name = payload.full_name.strip()

        if "telegram_chat_id" in payload.model_fields_set:
            current_user.telegram_chat_id = payload.telegram_chat_id.strip() if payload.telegram_chat_id else None

        if payload.studio_logo_url is not None:
            clean_logo = payload.studio_logo_url.strip() if payload.studio_logo_url else None
            if clean_logo and not is_admin and not plan_cfg.can_customize_branding:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Custom Studio Logo white-labeling is not enabled for the {user_plan.capitalize()} Plan. Please upgrade to unlock."
                )
            current_user.studio_logo_url = clean_logo

        color_candidate = payload.brand_accent_color if payload.brand_accent_color is not None else payload.brand_color
        if color_candidate is not None:
            clean_color = color_candidate.strip() if color_candidate else "#D97706"
            if clean_color.upper() not in ("#F59E0B", "#D97706") and not is_admin and not plan_cfg.can_customize_branding:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Custom brand color accent is not enabled for the {user_plan.capitalize()} Plan. Please upgrade to unlock."
                )
            if is_admin or plan_cfg.can_customize_branding:
                current_user.brand_color = clean_color
                current_user.brand_accent_color = clean_color
            else:
                current_user.brand_color = "#D97706"
                current_user.brand_accent_color = "#D97706"

        phone = payload.contact_phone if payload.contact_phone is not None else payload.phone_number
        if phone is not None:
            current_user.contact_phone = phone.strip() or None
        tt = payload.tiktok_url if payload.tiktok_url is not None else payload.tiktok
        if tt is not None:
            current_user.tiktok_url = tt.strip() or None
        insta = payload.instagram_url if payload.instagram_url is not None else payload.instagram
        if insta is not None:
            current_user.instagram_url = insta.strip() or None
        tg = payload.telegram_url if payload.telegram_url is not None else payload.telegram_username
        if tg is not None:
            current_user.telegram_url = tg.strip() or None
        yt = payload.youtube_url if payload.youtube_url is not None else payload.youtube
        if yt is not None:
            current_user.youtube_url = yt.strip() or None

        db.commit()
        db.refresh(current_user)
        return UserResponse.model_validate(current_user)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[DB Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating profile: {req_id}"
        )
    except Exception as exc:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[Unexpected Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error updating profile: {req_id}"
        )


@router.post("/upload-logo", status_code=status.HTTP_200_OK)
def upload_studio_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_plan = getattr(current_user, "subscription_plan", "basic") or "basic"
    plan_cfg = get_or_create_plan_config(db, user_plan)
    if current_user.role != UserRole.ADMIN and not plan_cfg.can_customize_branding:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Custom Studio Logo white-labeling is not enabled on the {user_plan.capitalize()} Plan. Please upgrade to unlock."
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a PNG, JPEG, WEBP, or SVG image."
        )

    try:
        file.file.seek(0)
        file_bytes = file.file.read(MAX_LOGO_BYTES + 1)
    except Exception as exc:
        req_id = uuid.uuid4().hex
        logger.error(f"[File Read Error {req_id}] {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read image file: {req_id}"
        )

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    if len(file_bytes) > MAX_LOGO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Logo file exceeds the 5 MB size limit."
        )

    if not is_cloudinary_configured():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cloud Storage is not configured. Stateless system requires cloud storage."
        )

    clean_filename = os.path.basename(file.filename or "logo.png")
    try:
        cloud_res = upload_file_to_cloudinary(
            file_bytes=file_bytes,
            filename=f"studio_logo_{current_user.id}_{clean_filename}",
            folder="photoguard_vault/studio_logos"
        )
        logo_url = cloud_res["high_res_url"]
        logger.info(f"[Logo Upload] Uploaded studio logo to Cloudinary: {logo_url}")
    except Exception as cloud_err:
        logger.error(f"[Logo Upload Error] Cloudinary upload failed: {cloud_err}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cloud Storage Upload Failed"
        )

    try:
        current_user.studio_logo_url = logo_url
        db.commit()
        db.refresh(current_user)
    except Exception as db_err:
        db.rollback()
        req_id = uuid.uuid4().hex
        logger.error(f"[Logo DB Error {req_id}] Failed to link logo to user: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save logo URL to profile: {req_id}"
        )

    return {"url": logo_url}
