from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, Request, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import jwt
from .auth import SECRET_KEY, ALGORITHM
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from sqlalchemy import func
from sqlalchemy.orm import Session
from . import models, storage
from .logger import log
from .db import get_db, init_db
from .auth import verify_telegram_auth, create_access_token
from .authorization import (
    require_admin,
    require_admin_or_photographer,
    require_album_owner,
    require_client_album,
    require_photographer,
)
from .rate_limit import limiter
from .metrics import metrics
from .schemas import (
    BrandingUpdateRequest,
    PublicBrandingResponse,
    PublicPhotoResponse,
    WatermarkProfileResponse,
    WatermarkUpdateRequest,
)
from .stream_tokens import TOKEN_TTL_SECONDS, stream_token_store
import datetime
import json
import mimetypes
import os
import re
import requests
import uuid
import sys
from urllib.parse import quote

# Ensure tables exist
init_db()

# Telegram fallback setup
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from telegram_utils import send_telegram_message_async
except ImportError:
    def send_telegram_message_async(chat_id, msg):
        log.warning(f"Telegram utils missing. Could not send: {msg}")

app = FastAPI(title="PhotoGuard Live API", version="4.0.0")
app.state.limiter = limiter


def handle_rate_limit_exceeded(request: Request, exc: RateLimitExceeded):
    metrics.record_security_event("rate_limit_trigger")
    return _rate_limit_exceeded_handler(request, exc)


app.add_exception_handler(RateLimitExceeded, handle_rate_limit_exceeded)


@app.middleware("http")
async def disable_api_caching(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        if request.url.path != "/api/admin/metrics":
            metrics.record_request(request.url.path, response.status_code)
        if response.status_code in (401, 403):
            metrics.record_security_event("unauthorized_access")
    return response


def _expiry_payload(album: models.Album, tier: str) -> dict:
    if not album.expires_at:
        return {
            "expires_at": None,
            "expires_in": None,
            "expires_in_days": None,
            "is_locked": False,
            "expiry_tier": tier,
        }

    seconds_remaining = max(0, int((album.expires_at - datetime.datetime.utcnow()).total_seconds()))
    return {
        "expires_at": album.expires_at.isoformat(),
        "expires_in": seconds_remaining,
        "expires_in_days": round(seconds_remaining / 86400, 4),
        "is_locked": seconds_remaining == 0,
        "expiry_tier": tier,
    }

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClientSelectionPayload(BaseModel):
    selected_photo_ids: List[int]
    notes: Optional[str] = None

class TelegramAuthPayload(BaseModel):
    id: int
    first_name: str
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


@app.post("/api/auth/telegram")
def telegram_login(payload: TelegramAuthPayload, db: Session = Depends(get_db)):
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        raise HTTPException(status_code=500, detail="TELEGRAM_BOT_TOKEN is not configured")

    auth_data = payload.dict(exclude_none=True)
    if not verify_telegram_auth(auth_data, bot_token):
        log.warning("Invalid Telegram Login Widget payload for ID %s", payload.id)
        raise HTTPException(status_code=401, detail="Invalid Telegram authentication data")

    telegram_id = str(payload.id)
    role = "admin" if telegram_id == os.getenv("SUPER_ADMIN_TELEGRAM_ID", "") else "photographer"
    user = db.query(models.User).filter(models.User.telegram_id == telegram_id).first()
    if not user:
        user = models.User(
            telegram_id=telegram_id,
            first_name=payload.first_name,
            username=payload.username,
            photo_url=payload.photo_url,
            role=role,
            tier="starter",
        )
        db.add(user)
    else:
        user.first_name = payload.first_name
        user.username = payload.username
        user.photo_url = payload.photo_url
        user.role = role
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role, "telegram_id": telegram_id})
    return {"success": True, "token": token, "user": {
        "id": user.id,
        "first_name": user.first_name,
        "role": user.role,
        "tier": user.tier,
        "photo_url": user.photo_url,
    }}


def _deep_link_session_key(session_uuid: str) -> str:
    return f"telegram:deep-link:{session_uuid}"


def _issue_user_session(user: models.User) -> dict:
    return {
        "token": create_access_token({
            "sub": str(user.id),
            "role": user.role,
            "telegram_id": user.telegram_id,
        }),
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "role": user.role,
            "tier": user.tier,
            "photo_url": user.photo_url,
        },
    }


@app.post("/api/auth/telegram/deep-link/init")
def init_telegram_deep_link():
    session_uuid = str(uuid.uuid4())
    redis_client.set(
        _deep_link_session_key(session_uuid),
        json.dumps({"status": "pending"}),
        ex=300,
    )
    bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "photoguard_alert_bot").lstrip("@")
    return {
        "session_uuid": session_uuid,
        "bot_url": f"https://t.me/{bot_username}?start={session_uuid}",
        "expires_in": 300,
    }


@app.get("/api/auth/status/{session_uuid}")
def telegram_deep_link_status(session_uuid: str):
    try:
        uuid.UUID(session_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid session UUID") from exc

    raw = redis_client.get(_deep_link_session_key(session_uuid))
    if not raw:
        raise HTTPException(status_code=404, detail="Authentication session expired")
    try:
        session_data = json.loads(raw)
    except (TypeError, ValueError) as exc:
        log.error("Invalid deep-link session payload: %s", exc)
        raise HTTPException(status_code=500, detail="Invalid authentication session") from exc

    if session_data.get("status") != "authenticated":
        return {"status": "pending"}

    redis_client.delete(_deep_link_session_key(session_uuid))
    return {"status": "authenticated", "token": session_data["token"], "user": session_data["user"]}


@app.post("/api/telegram/webhook")
async def telegram_deep_link_webhook(request: Request, db: Session = Depends(get_db)):
    update = await request.json()
    message = update.get("message") or {}
    telegram_user = message.get("from") or {}
    text = (message.get("text") or "").strip()
    match = re.fullmatch(r"/start(?:@[^ ]+)?(?:\s+([0-9a-fA-F-]{36}))?", text)
    if not match or not match.group(1) or not telegram_user.get("id"):
        return {"ok": True}

    session_uuid = match.group(1)
    session_key = _deep_link_session_key(session_uuid)
    raw_session = redis_client.get(session_key)
    if not raw_session:
        return {"ok": True}

    telegram_id = str(telegram_user["id"])
    role = "admin" if telegram_id == os.getenv("SUPER_ADMIN_TELEGRAM_ID", "") else "photographer"
    user = db.query(models.User).filter(models.User.telegram_id == telegram_id).first()
    if not user:
        user = models.User(
            telegram_id=telegram_id,
            first_name=telegram_user.get("first_name") or "User",
            username=telegram_user.get("username"),
            photo_url=telegram_user.get("photo_url"),
            role=role,
            tier="starter",
        )
        db.add(user)
    else:
        user.first_name = telegram_user.get("first_name") or user.first_name
        user.username = telegram_user.get("username") or user.username
        user.photo_url = telegram_user.get("photo_url") or user.photo_url
        user.role = role
    db.commit()
    db.refresh(user)

    session_payload = _issue_user_session(user)
    redis_client.set(
        session_key,
        json.dumps({"status": "authenticated", **session_payload}),
        ex=120,
    )

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if bot_token:
        try:
            requests.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": telegram_id,
                    "text": "Welcome! You are logged in. You will receive your PhotoGuard notifications here.",
                },
                timeout=8,
            ).raise_for_status()
        except requests.RequestException as exc:
            log.warning("Telegram welcome message failed: %s", exc)
    return {"ok": True}

def trigger_photographer_notification(album_code: str, num_photos: int, notes: str, photographer_telegram_id: str):
    msg = (
        f"📸 <b>PhotoGuard Client Alert</b>\n\n"
        f"A client has finished selecting photos for Album: <code>{album_code}</code>\n"
        f"<b>Selected Photos:</b> {num_photos}\n"
        f"<b>Client Notes:</b> <i>{notes}</i>\n\n"
        f"<a href='https://photoguard.com/dashboard'>View on Dashboard</a>"
    )
    log.info(f"[TELEGRAM TRIGGER] Dispatching alert for Album {album_code} to Photographer ID {photographer_telegram_id}")
    send_telegram_message_async(photographer_telegram_id, msg)


# --- AUTHENTICATION ENDPOINT ---

@app.get("/api/v1/auth/telegram/callback")
def telegram_auth_callback(request: Request, db: Session = Depends(get_db)):
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        return RedirectResponse(url="/?error=ServerMisconfiguration")
        
    query_params = dict(request.query_params)
    if 'hash' not in query_params:
        return RedirectResponse(url="/?error=MissingHash")

    # Copy params for verification because verify_telegram_auth modifies the dict
    auth_data = query_params.copy()
    if not verify_telegram_auth(auth_data, bot_token):
        log.warning(f"Invalid Telegram callback hash for ID {query_params.get('id')}")
        return RedirectResponse(url="/?error=InvalidAuthData")

    telegram_id_str = str(query_params.get("id"))
    first_name = query_params.get("first_name", "User")
    username = query_params.get("username", "")
    photo_url = query_params.get("photo_url", "")

    super_admin_id = os.getenv("SUPER_ADMIN_TELEGRAM_ID", "")
    role = "admin" if telegram_id_str == super_admin_id else "photographer"

    user = db.query(models.User).filter(models.User.telegram_id == telegram_id_str).first()

    if not user:
        log.info(f"Registering new {role} via Telegram Callback: {telegram_id_str}")
        user = models.User(
            telegram_id=telegram_id_str,
            first_name=first_name,
            username=username,
            photo_url=photo_url,
            role=role,
            tier="starter" # Tier Gating: Auto-register new users as 'starter'
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update details but PRESERVE existing tier (Starter/Pro/Studio)
        user.first_name = first_name
        user.username = username
        user.photo_url = photo_url
        user.role = role
        db.commit()

    # Generate access token
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role, "telegram_id": telegram_id_str})
    
    # Redirect back to the frontend with token and user details for seamless login
    redirect_url = f"/?token={access_token}&role={user.role}&id={user.id}&name={user.first_name}&tier={user.tier}"
    return RedirectResponse(url=redirect_url)

@app.post("/api/v1/auth/telegram")
def authenticate_telegram(payload: TelegramAuthPayload, db: Session = Depends(get_db)):
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        log.error("TELEGRAM_BOT_TOKEN not configured.")
        raise HTTPException(status_code=500, detail="Server misconfiguration.")

    # Convert payload to dictionary for verification
    auth_data = payload.dict(exclude_none=True)
    
    # 1. Verify integrity of the data
    if not verify_telegram_auth(auth_data, bot_token):
        log.warning(f"Invalid Telegram login attempt for ID {payload.id}")
        raise HTTPException(status_code=401, detail="Data verification failed.")
    
    telegram_id_str = str(payload.id)
    
    # 2. Check if this is the Super Admin
    super_admin_id = os.getenv("SUPER_ADMIN_TELEGRAM_ID", "")
    role = "admin" if telegram_id_str == super_admin_id else "photographer"
    
    # 3. Get or Create User in DB
    user = db.query(models.User).filter(models.User.telegram_id == telegram_id_str).first()
    
    if not user:
        log.info(f"Registering new {role} via Telegram Auth: {telegram_id_str}")
        user = models.User(
            telegram_id=telegram_id_str,
            first_name=payload.first_name,
            username=payload.username,
            photo_url=payload.photo_url,
            role=role,
            tier="starter" # Default for new photographers
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update dynamic fields
        user.first_name = payload.first_name
        user.username = payload.username
        user.photo_url = payload.photo_url
        user.role = role # Enforce role based on env var in case it changed
        db.commit()
    
    # 4. Generate Session Token
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role, "telegram_id": telegram_id_str})
    
    log.info(f"Successful Telegram Login for {user.first_name} (Role: {user.role})")
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "role": user.role,
            "tier": user.tier,
            "photo_url": user.photo_url
        }
    }



oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
        
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/api/payments/submit", dependencies=[Depends(require_photographer)])
def submit_payment(target_plan: str, payment_method: str, transaction_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Photographer submits a manual payment receipt
    receipt = models.PaymentReceipt(
        user_id=current_user.id,
        target_plan=target_plan,
        payment_method=payment_method,
        transaction_id=transaction_id,
        status="PENDING"
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return {"success": True, "message": "Payment submitted and awaiting admin approval.", "receipt_id": receipt.id}

@app.get("/api/admin/payments", dependencies=[Depends(require_admin)])
def list_pending_payments(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    payments = db.query(models.PaymentReceipt).filter(models.PaymentReceipt.status == "PENDING").all()
    # Eager load user data if needed, or format
    return {"success": True, "payments": [
        {
            "id": p.id,
            "photographer_name": p.user.first_name,
            "target_plan": p.target_plan,
            "payment_method": p.payment_method,
            "transaction_id": p.transaction_id,
            "created_at": p.created_at
        } for p in payments
    ]}

@app.post("/api/admin/payments/{receipt_id}/approve", dependencies=[Depends(require_admin)])
def approve_payment(receipt_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    receipt = db.query(models.PaymentReceipt).filter(models.PaymentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    if receipt.status != "PENDING":
        raise HTTPException(status_code=400, detail="Receipt is not pending")
        
    # Approve and upgrade tier
    receipt.status = "APPROVED"
    photographer = db.query(models.User).filter(models.User.id == receipt.user_id).first()
    if photographer:
        photographer.tier = receipt.target_plan
        
    db.commit()
    return {"success": True, "message": f"Payment approved. User upgraded to {receipt.target_plan}."}

@app.post("/api/admin/payments/{receipt_id}/reject", dependencies=[Depends(require_admin)])
def reject_payment(receipt_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    receipt = db.query(models.PaymentReceipt).filter(models.PaymentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    receipt.status = "REJECTED"
    db.commit()
    return {"success": True, "message": "Payment rejected."}


# --- EXISTING ENDPOINTS ---


class LoginRequest(BaseModel):
    email: str
    password: str

class AlbumCreateRequest(BaseModel):
    name: str
    expires: str


def _branding_payload(user: models.User) -> dict:
    return {
        "brand_color": getattr(user, "brand_color", None) or "#24A1DE",
        "logo_url": getattr(user, "logo_url", None),
        "custom_welcome_message": getattr(user, "custom_welcome_message", None),
    }


@app.get("/api/photographers/{photographer_id}/branding", response_model=PublicBrandingResponse)
def get_public_branding(photographer_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.id == photographer_id,
        models.User.role == "photographer",
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Photographer not found")
    return _branding_payload(user)


@app.get("/api/photographer/branding", response_model=PublicBrandingResponse)
def get_my_branding(current_user: models.User = Depends(require_photographer)):
    return _branding_payload(current_user)


@app.put("/api/photographer/branding", response_model=PublicBrandingResponse)
def update_my_branding(
    payload: BrandingUpdateRequest,
    current_user: models.User = Depends(require_photographer),
    db: Session = Depends(get_db),
):
    if payload.brand_color is not None and not re.fullmatch(r"#[0-9a-fA-F]{6}", payload.brand_color):
        raise HTTPException(status_code=422, detail="brand_color must be a six-digit hex color")
    if payload.logo_url is not None and payload.logo_url and not payload.logo_url.startswith("https://"):
        raise HTTPException(status_code=422, detail="logo_url must use HTTPS")
    if payload.custom_welcome_message is not None and len(payload.custom_welcome_message) > 500:
        raise HTTPException(status_code=422, detail="custom_welcome_message is too long")

    if payload.brand_color is not None:
        current_user.brand_color = payload.brand_color
    if payload.logo_url is not None:
        current_user.logo_url = payload.logo_url or None
    if payload.custom_welcome_message is not None:
        current_user.custom_welcome_message = payload.custom_welcome_message or None
    db.commit()
    db.refresh(current_user)
    return _branding_payload(current_user)


@app.post("/api/photographer/branding/logo", response_model=PublicBrandingResponse)
async def upload_brand_logo(
    logo: UploadFile = File(...),
    current_user: models.User = Depends(require_photographer),
    db: Session = Depends(get_db),
):
    if logo.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=415, detail="Logo must be PNG, JPEG, or WebP")
    file_bytes = await logo.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Logo must be smaller than 5 MB")
    try:
        result = storage.cloudinary.uploader.upload(
            file_bytes,
            folder=f"photoguard/branding/{current_user.id}",
            public_id="logo",
            overwrite=True,
            resource_type="image",
        )
        current_user.logo_url = result["secure_url"]
        db.commit()
        db.refresh(current_user)
    except Exception as exc:
        log.error("Brand logo upload failed for photographer %s: %s", current_user.id, exc)
        raise HTTPException(status_code=502, detail="Logo upload unavailable") from exc
    return _branding_payload(current_user)


def _watermark_payload(user: models.User) -> dict:
    return {
        "watermark_text": getattr(user, "watermark_text", None) or "Protected by PhotoGuard",
        "watermark_logo_url": getattr(user, "watermark_logo_url", None),
        "watermark_opacity": float(getattr(user, "watermark_opacity", None) or 40),
        "watermark_position": getattr(user, "watermark_position", None) or "center",
    }


@app.get("/api/photographer/watermark", response_model=WatermarkProfileResponse)
def get_my_watermark(current_user: models.User = Depends(require_photographer)):
    return _watermark_payload(current_user)


@app.put("/api/photographer/watermark", response_model=WatermarkProfileResponse)
def update_my_watermark(
    payload: WatermarkUpdateRequest,
    current_user: models.User = Depends(require_photographer),
    db: Session = Depends(get_db),
):
    positions = {"center", "top-left", "top-right", "bottom-left", "bottom-right"}
    if payload.watermark_text is not None and len(payload.watermark_text) > 120:
        raise HTTPException(status_code=422, detail="watermark_text is too long")
    if payload.watermark_opacity is not None and not 10 <= payload.watermark_opacity <= 90:
        raise HTTPException(status_code=422, detail="watermark_opacity must be between 10 and 90")
    if payload.watermark_position is not None and payload.watermark_position not in positions:
        raise HTTPException(status_code=422, detail="Unsupported watermark position")
    if payload.watermark_logo_url is not None and payload.watermark_logo_url and not payload.watermark_logo_url.startswith("https://"):
        raise HTTPException(status_code=422, detail="watermark_logo_url must use HTTPS")

    if payload.watermark_text is not None:
        current_user.watermark_text = payload.watermark_text or None
    if payload.watermark_logo_url is not None:
        current_user.watermark_logo_url = payload.watermark_logo_url or None
    if payload.watermark_opacity is not None:
        current_user.watermark_opacity = payload.watermark_opacity
    if payload.watermark_position is not None:
        current_user.watermark_position = payload.watermark_position
    db.commit()
    db.refresh(current_user)
    return _watermark_payload(current_user)


@app.post("/api/photographer/watermark/logo", response_model=WatermarkProfileResponse)
async def upload_watermark_logo(
    logo: UploadFile = File(...),
    current_user: models.User = Depends(require_photographer),
    db: Session = Depends(get_db),
):
    if logo.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=415, detail="Logo must be PNG, JPEG, or WebP")
    file_bytes = await logo.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Logo must be smaller than 5 MB")
    try:
        result = storage.cloudinary.uploader.upload(
            file_bytes,
            folder=f"photoguard/watermarks/{current_user.id}",
            public_id="logo",
            overwrite=True,
            resource_type="image",
        )
        current_user.watermark_logo_url = result["secure_url"]
        db.commit()
        db.refresh(current_user)
    except Exception as exc:
        log.error("Watermark logo upload failed for photographer %s: %s", current_user.id, exc)
        raise HTTPException(status_code=502, detail="Watermark logo upload unavailable") from exc
    return _watermark_payload(current_user)

import bcrypt

@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    # Mock seeding if user doesn't exist (for seamless dev transition)
    if not user:
        if req.email == "admin@photoguard.com":
            user = models.User(email=req.email, hashed_password=bcrypt.hashpw("password".encode(), bcrypt.gensalt()).decode(), role="admin")
        elif req.email == "photo@photoguard.com":
            user = models.User(email=req.email, hashed_password=bcrypt.hashpw("password".encode(), bcrypt.gensalt()).decode(), role="photographer", tier="pro")
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.hashed_password or not bcrypt.checkpw(req.password.encode(), user.hashed_password.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {"token": token, "user": {"id": user.id, "email": user.email, "role": user.role}}

@app.get("/api/albums")
def list_albums(current_user: models.User = Depends(require_admin_or_photographer), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        albums = db.query(models.Album).all()
    else:
        albums = db.query(models.Album).filter(models.Album.photographer_id == current_user.id).all()
    
    result = []
    for a in albums:
        image_count = db.query(models.Photo).filter(models.Photo.album_id == a.id).count()
        result.append({
            "id": a.id,
            "name": a.name,
            "code": a.code,
            "photographerId": a.photographer_id,
            "imageCount": image_count,
            "expires": a.expires_at.strftime("%Y-%m-%d") if a.expires_at else "Never",
            **_expiry_payload(a, current_user.tier),
        })
    return result

@app.post("/api/albums")
def create_album(req: AlbumCreateRequest, current_user: models.User = Depends(require_admin_or_photographer), db: Session = Depends(get_db)):
    import random
    import string
    import datetime
    
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    album = models.Album(
        name=req.name,
        code=code,
        photographer_id=current_user.id,
        expires_at=datetime.datetime.strptime(req.expires, "%Y-%m-%d") if req.expires else None
    )
    db.add(album)
    db.commit()
    db.refresh(album)
    return {
        "id": album.id,
        "name": album.name,
        "code": album.code,
        "photographerId": album.photographer_id,
        "imageCount": 0,
        "expires": req.expires,
        **_expiry_payload(album, current_user.tier),
    }


@app.get("/api/albums/{album_id}/analytics")
def get_album_analytics(
    album_id: int,
    current_user: models.User = Depends(require_admin_or_photographer),
    db: Session = Depends(get_db),
):
    album = db.query(models.Album).filter(models.Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    if current_user.role != "admin" and album.photographer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Album belongs to another photographer")

    access_query = db.query(models.ClientAccessLog).filter(
        models.ClientAccessLog.album_id == album.id
    )
    successful_pin_entries = access_query.count()
    last_access = access_query.order_by(models.ClientAccessLog.accessed_at.desc()).first()
    photo_count = db.query(func.count(models.Photo.id)).filter(
        models.Photo.album_id == album.id
    ).scalar() or 0

    return {
        "album_id": album.id,
        "album_name": album.name,
        "total_views": successful_pin_entries,
        "successful_pin_entries": successful_pin_entries,
        "last_accessed_at": last_access.accessed_at.isoformat() if last_access else None,
        "photo_count": photo_count,
        **_expiry_payload(album, current_user.tier),
    }


def _stream_reference_for_photo(photo: models.Photo) -> tuple[str, str]:
    token = stream_token_store.issue(photo.id)
    return token, f"/api/photos/stream?token={quote(token, safe='')}"


def _stream_url_for_photo(photo: models.Photo) -> str:
    return _stream_reference_for_photo(photo)[1]


def _public_photo_response(photo: models.Photo) -> dict:
    stream_token, stream_url = _stream_reference_for_photo(photo)
    return PublicPhotoResponse(
        id=photo.id,
        filename=photo.filename,
        token=stream_token,
        url=stream_url,
        selected=photo.is_selected,
    ).dict(exclude_none=True)

@app.get("/api/gallery/{album_code}")
def get_gallery(album_code: str, album: models.Album = Depends(require_client_album)):
    images = []
    for photo in album.photos:
        images.append(_public_photo_response(photo))
    return {
        "albumName": album.name,
        "photographerId": album.photographer_id,
        "images": images,
    }

class VerifyCodeRequest(BaseModel):
    code: str = None
    pin: str = None
    device_uuid: str = None

@app.post("/api/albums/verify-code")
@limiter.limit("5/minute")
def verify_album_code(request: Request, req: VerifyCodeRequest, db: Session = Depends(get_db)):
    code_to_check = req.code or req.pin
    album = db.query(models.Album).filter(models.Album.code == code_to_check).first()
    if not album:
        metrics.record_security_event("failed_pin_attempt")
        return {"status": "error", "message": "Invalid access code."}

    db.add(models.ClientAccessLog(
        album_id=album.id,
        device_uuid=req.device_uuid or "Unknown",
        ip_address=request.client.host if request.client else None,
    ))
    db.commit()
    
    photographer_name = "PhotoGuard Studio"
    if album.photographer:
        photographer_name = album.photographer.first_name or album.photographer.username or "Studio"

    media_tokens = []
    for photo in album.photos:
        media_tokens.append(_public_photo_response(photo))
    
    return {
        "albumId": str(album.id),
        "title": album.name,
        "photographerId": album.photographer_id,
        "media": media_tokens,
        "photos": media_tokens, # Add both just in case
        "photographerName": photographer_name,
        "selectionLimit": 50,
        "isLocked": False,
        "downloadEnabled": False,
        "status": "success"
    }

@app.get("/api/photos/stream")
def stream_photo(token: str, db: Session = Depends(get_db)):
    photo_id = stream_token_store.consume(token)
    if photo_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired stream token")
    
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
        
    origin_url = photo.watermarked_url or photo.secure_s3_url
    if not origin_url:
        raise HTTPException(status_code=404, detail="Photo URL not set")

    if origin_url.startswith("s3://"):
        origin_url = storage.generate_presigned_download_url(
            origin_url, expiration_seconds=TOKEN_TTL_SECONDS
        )

    try:
        upstream = requests.get(origin_url, stream=True, timeout=15)
        upstream.raise_for_status()
    except requests.RequestException as exc:
        log.error("Secure photo stream failed for photo %s: %s", photo_id, exc)
        raise HTTPException(status_code=502, detail="Photo stream unavailable") from exc

    media_type = mimetypes.guess_type(photo.filename or "")[0] or "application/octet-stream"

    def iter_photo_chunks():
        try:
            for chunk in upstream.iter_content(chunk_size=64 * 1024):
                if chunk:
                    metrics.record_bandwidth(len(chunk))
                    yield chunk
        finally:
            upstream.close()

    return StreamingResponse(
        iter_photo_chunks(),
        media_type=media_type,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )

@app.post("/api/security/log", dependencies=[Depends(require_admin)])
def log_security(req: dict):
    log.warning(f"Security event logged: {req}")
    return {"status": "ok"}

@app.post("/api/albums/{album_code}/photos", dependencies=[Depends(require_album_owner)])
async def upload_photos(album_code: str, current_user: models.User = Depends(get_current_user), photos: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    photographer_id = current_user.id
    photographer_tier = current_user.tier
    
    
    album = db.query(models.Album).filter(models.Album.code == album_code).first()
    if not album:
        album = models.Album(name=f"Album {album_code}", code=album_code, photographer_id=photographer_id)
        db.add(album)
        db.commit()
        db.refresh(album)

    uploaded_data = []
    watermark_profile = {
        "text": current_user.watermark_text or current_user.first_name or current_user.username or "Protected by PhotoGuard",
        "logo_url": current_user.watermark_logo_url,
        "opacity": current_user.watermark_opacity or 40,
        "position": current_user.watermark_position or "center",
    }
    for file in photos:
        file_bytes = await file.read()
        urls = await storage.upload_photo_multicloud(
            file_bytes,
            file.filename,
            album_code,
            photographer_tier,
            watermark_profile,
        )
        
        new_photo = models.Photo(
            filename=file.filename,
            watermarked_url=urls["watermarked_url"],
            secure_s3_url=urls["secure_s3_url"],
            album_id=album.id
        )
        db.add(new_photo)
        db.commit()
        metrics.record_upload(1, len(file_bytes))
        uploaded_data.append({"filename": file.filename})
        
    return {"success": True, "tier_applied": photographer_tier, "data": uploaded_data}

@app.post("/api/gallery/{album_code}/submit")
def client_submit_selections(album_code: str, payload: ClientSelectionPayload, background_tasks: BackgroundTasks, album: models.Album = Depends(require_client_album), db: Session = Depends(get_db)):
    db.query(models.Photo).filter(
        models.Photo.id.in_(payload.selected_photo_ids),
        models.Photo.album_id == album.id,
    ).update({"is_selected": True})
    
    submission = models.ClientSubmission(album_id=album.id, client_notes=payload.notes)
    db.add(submission)
    
    # Get photographer's telegram ID
    photographer = db.query(models.User).filter(models.User.id == album.photographer_id).first()
    photographer_tg_id = photographer.telegram_id if photographer else os.getenv("SUPER_ADMIN_TELEGRAM_ID", "")
    
    db.commit()
    
    if photographer_tg_id:
        background_tasks.add_task(trigger_photographer_notification, album_code, len(payload.selected_photo_ids), payload.notes or "None", photographer_tg_id)
    
    return {"success": True, "message": "Selections submitted! Photographer notified."}

@app.get("/api/albums/{album_code}/download_originals", dependencies=[Depends(require_album_owner)])
def get_high_res_downloads(album_code: str, current_user: models.User = Depends(require_admin_or_photographer), db: Session = Depends(get_db)):
    photographer_tier = current_user.tier
    
    
    if photographer_tier == "starter" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="High-resolution downloads are locked for Starter plans. Please upgrade.")
        
    album = db.query(models.Album).filter(models.Album.code == album_code).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
        
    photos = db.query(models.Photo).filter(models.Photo.album_id == album.id, models.Photo.is_selected == True).all()
    download_links = [{"filename": p.filename, "download_url": _stream_url_for_photo(p)} for p in photos]
        
    return {"success": True, "downloads": download_links}


    @app.get("/api/admin/metrics", dependencies=[Depends(require_admin)])
    def get_platform_metrics():
        return metrics.snapshot()

# Mount React Frontend if running on Render / Production
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'frontend', 'dist')
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        return FileResponse(index_path)


import datetime

@app.post("/api/admin/trigger-expiry-notifications", dependencies=[Depends(require_admin)])
def trigger_expiry_notifications(db: Session = Depends(get_db)):
    # Find albums expiring in exactly 3 days
    now = datetime.datetime.utcnow()
    three_days_from_now = now + datetime.timedelta(days=3)
    
    albums = db.query(models.Album).filter(
        models.Album.expires_at >= now,
        models.Album.expires_at <= three_days_from_now
    ).all()
    
    notified_count = 0
    for album in albums:
        photographer = db.query(models.User).filter(models.User.id == album.photographer_id).first()
        if photographer and photographer.telegram_id:
            msg = (
                f"⚠️ <b>Expiry Warning</b>\n\n"
                f"Your album <code>{album.code}</code> ({album.name}) is expiring on {album.expires_at.strftime('%Y-%m-%d')}.\n"
                f"Please remind your client to submit their selections!"
            )
            send_telegram_message_async(photographer.telegram_id, msg)
            notified_count += 1
            
    return {"success": True, "notified_count": notified_count}
