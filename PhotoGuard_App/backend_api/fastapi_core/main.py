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
from .schemas import PublicPhotoResponse
from .stream_tokens import TOKEN_TTL_SECONDS, stream_token_store
import datetime
import mimetypes
import os
import requests
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
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def disable_api_caching(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response

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
            "expires": a.expires_at.strftime("%Y-%m-%d") if a.expires_at else "Never"
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
        "expires": req.expires
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
    return {"albumName": album.name, "images": images}

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
        return {"status": "error", "message": "Invalid access code."}
    
    photographer_name = "PhotoGuard Studio"
    if album.photographer:
        photographer_name = album.photographer.first_name or album.photographer.username or "Studio"

    media_tokens = []
    for photo in album.photos:
        media_tokens.append(_public_photo_response(photo))
    
    return {
        "albumId": str(album.id),
        "title": album.name,
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
    for file in photos:
        file_bytes = await file.read()
        urls = await storage.upload_photo_multicloud(file_bytes, file.filename, album_code, photographer_tier)
        
        new_photo = models.Photo(
            filename=file.filename,
            watermarked_url=urls["watermarked_url"],
            secure_s3_url=urls["secure_s3_url"],
            album_id=album.id
        )
        db.add(new_photo)
        db.commit()
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
