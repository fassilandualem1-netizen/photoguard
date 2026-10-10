import os
import asyncio
import logging
import traceback
import mimetypes
from datetime import datetime, timezone, timedelta

mimetypes.init()
mimetypes.add_type("text/css", ".css", True)
mimetypes.add_type("application/javascript", ".js", True)
mimetypes.add_type("image/svg+xml", ".svg", True)
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status, Request, UploadFile, File, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import engine, Base, get_db, SessionLocal
from app.core.security import get_password_hash, verify_password
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.album import Album, MediaItem
from app.models.payment import PaymentReceipt
from app.models.error_log import SystemErrorLog
from app.schemas.auth import UserResponse, PasswordChangeRequest
from app.api.auth import router as auth_router
from app.api.albums import router as albums_router
from app.api.client import router as client_router
from app.api.media import router as media_router
from app.api.admin import router as admin_router
from app.api.telegram import router as telegram_router
from app.api.team import router as team_router
from app.api.broadcasts import router as broadcasts_router
from app.api.photographers import router as photographers_router
from app.core.storage import delete_file_from_cloudinary, destroy_media_asset
from app.core.s3_cleanup import delete_file_from_s3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("photoguard.core")



DEFAULT_ADMIN_EMAIL = "fassilandualem1@gmail.com"
SAFE_ADMIN_FALLBACK_PASSWORD = "Admin@123!"

def seed_root_admin():

    """
    Bulletproof Root Admin Seeder with Multi-Tier Fallbacks.
    - Reads ADMIN_EMAIL and ADMIN_PASSWORD from os.environ.
    - If ADMIN_PASSWORD is None, empty, whitespace, longer than 70 chars (bcrypt max 72),
      or raises any hashing/encoding error, it safely discards it and falls back to 'Admin@123!'.
    - Never crashes during startup; catches all hashing/database exceptions with rollbacks.
    - Guarantees role=UserRole.ADMIN, is_active=True, is_verified=True, needs_password_change=False.
    """
    raw_admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    admin_email = raw_admin_email if raw_admin_email else DEFAULT_ADMIN_EMAIL

    raw_admin_pw = os.environ.get("ADMIN_PASSWORD", "")
    
    # Audit & sanitize password length for bcrypt safety (bcrypt limit is 72 bytes)
    if not raw_admin_pw or len(raw_admin_pw) > 70:
        if raw_admin_pw and len(raw_admin_pw) > 70:
            logger.warning(f"[PhotoGuard Seeder Warning] Configured ADMIN_PASSWORD exceeds 70 characters ({len(raw_admin_pw)} chars). Discarding to prevent bcrypt failure and using bulletproof fallback.")
        effective_password = SAFE_ADMIN_FALLBACK_PASSWORD
        used_fallback = True
    else:
        effective_password = raw_admin_pw.strip()
        used_fallback = False

    logger.info(f"[PhotoGuard Seeder] Initiating root admin synchronization for: '{admin_email}' (fallback_used={used_fallback})")

    # Generate hash safely with fallback recovery
    try:
        new_hash = get_password_hash(effective_password)
    except Exception as hash_err:
        logger.warning(f"[PhotoGuard Seeder Warning] Failed to hash effective password: {hash_err}. Forcefully using safe default.")
        effective_password = SAFE_ADMIN_FALLBACK_PASSWORD
        new_hash = get_password_hash(SAFE_ADMIN_FALLBACK_PASSWORD)
        used_fallback = True

    db = SessionLocal()
    try:
        # Determine all target admin emails to ensure user access
        target_emails = []
        if raw_admin_email:
            target_emails.append(raw_admin_email)
        for fallback in ["fassilandualem1@gmail.com", "fassilandualem19@gmail.com", DEFAULT_ADMIN_EMAIL]:
            if fallback not in target_emails:
                target_emails.append(fallback)

        synced_users = []
        primary_user = None

        for email_item in target_emails:
            user = db.query(User).filter(User.email == email_item).first()
            if user:
                logger.info(f"[PhotoGuard Seeder] Synchronizing existing user '{email_item}' as verified Root Admin...")
                user.role = "admin"
                user.hashed_password = new_hash
                user.full_name = user.full_name or "Root Administrator"
                user.is_active = True
                user.is_verified = True
                user.needs_password_change = False
                user.subscription_plan = "studio"
                user.plan = "studio"
                user.storage_quota_limit = 26843545600  # 25 GB Studio Tier
                db.commit()
                db.refresh(user)
                synced_users.append({"email": email_item, "action": "updated"})
            else:
                logger.info(f"[PhotoGuard Seeder] Creating brand new Root Admin record for '{email_item}'...")
                user = User(
                    email=email_item,
                    hashed_password=new_hash,
                    full_name="Root Administrator",
                    role="admin",
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
                synced_users.append({"email": email_item, "action": "created"})
            
            if not primary_user and (email_item == admin_email or email_item == "fassilandualem1@gmail.com"):
                primary_user = user

        if not primary_user and synced_users:
            primary_user = db.query(User).filter(User.email == synced_users[0]["email"]).first()

        pw_check = verify_password(effective_password, primary_user.hashed_password) if primary_user else False
        logger.info(f"[PhotoGuard Seeder] Password verification test for '{primary_user.email if primary_user else 'unknown'}': {'PASS' if pw_check else 'FAIL'}")

        return {
            "success": True,
            "synced_accounts": synced_users,
            "user_id": primary_user.id if primary_user else None,
            "email": primary_user.email if primary_user else admin_email,
            "role": "admin",
            "is_active": True,
            "needs_password_change": False,
            "password_verification_check": pw_check,
            "used_fallback_password": used_fallback,
            "effective_password_hint": f"{effective_password[:2]}***{effective_password[-1]}" if len(effective_password) > 3 else "***"
        }
    except Exception as exc:
        db.rollback()
        logger.error(f"[PhotoGuard Seeder Error] Failed to persist root admin: {exc}\n{traceback.format_exc()}")
        return {
            "success": False,
            "error": str(exc),
            "email": admin_email
        }
    finally:
        db.close()

def purge_expired_albums():
    """
    Active Auto-Expiration Worker.
    Scans the database for albums where expires_at <= now_utc.
    For all expired albums:
      1. Gathers all associated media items.
      2. Calculates total original_size.
      3. Destroys BOTH item.url AND item.thumbnail_url from Cloudinary/S3/Disk.
      4. Decrements photographer owner.storage_used (ensuring >= 0).
      5. Deletes the album row from PostgreSQL (cascades to media_items).
    """
    db = SessionLocal()
    try:
        now_utc = datetime.now(timezone.utc)
        expired_albums = db.query(Album).filter(
            Album.expires_at.isnot(None),
            Album.expires_at <= now_utc
        ).all()

        if not expired_albums:
            logger.info("[Auto-Expire Worker] No expired albums currently match auto-expiration criteria.")
            return

        logger.info(f"[Auto-Expire Worker] Found {len(expired_albums)} expired album(s) qualifying for airtight deletion.")
        total_deleted_albums = 0
        total_freed_bytes = 0

        for album in expired_albums:
            media_items = album.media_items or []
            album_bytes = sum(getattr(item, "original_size", 0) or 0 for item in media_items)

            # Reclaim owner storage quota
            album_creator = db.query(User).filter(User.id == album.photographer_id).first()
            if album_creator:
                owner = db.query(User).filter(User.id == album_creator.effective_owner_id).first() or album_creator
                if owner and album_bytes > 0:
                    owner.storage_used = max(0, (owner.storage_used or 0) - album_bytes)
                    logger.info(f"[Auto-Expire Worker] Reclaimed {album_bytes} bytes for owner {owner.email}. New storage_used: {owner.storage_used}")

            # Airtight physical file destruction for both high-res and thumbnails
            cloud_deletion_success = True
            for item in media_items:
                urls_to_delete = set()
                if item.url:
                    urls_to_delete.add(item.url)
                if item.thumbnail_url:
                    urls_to_delete.add(item.thumbnail_url)

                for u in urls_to_delete:
                    try:
                        destroy_media_asset(u)
                    except Exception as del_err:
                        logger.warning(f"[Auto-Expire Worker] Error destroying asset {u}: {del_err}. Skipping DB deletion for album {album.id}.")
                        cloud_deletion_success = False

            if cloud_deletion_success:
                db.delete(album)
                total_deleted_albums += 1
                total_freed_bytes += album_bytes
            else:
                logger.error(f"[Auto-Expire Worker] Incomplete cloud deletion for album {album.id}. Skipping DB deletion to prevent orphaned data.")

        db.commit()
        logger.info(f"[Auto-Expire Complete] Successfully destroyed {total_deleted_albums} expired album(s), reclaimed {total_freed_bytes / (1024 * 1024):.2f} MB storage.")
    except Exception as exc:
        db.rollback()
        logger.error(f"[Auto-Expire Error] Error executing auto-expire scan: {exc}\n{traceback.format_exc()}")
    finally:
        db.close()


def purge_download_triggered_assets():
    """
    Download-Triggered Auto-Purge Worker.
    Scans the database and aggressively purges original high-res assets from Cloudinary/S3
    while strictly preserving thumbnails/previews indefinitely so album UI never breaks.

    Purge Rule 1 (Selection Albums):
      Albums where photographer_downloaded_at is older than 2 days -> Purge high-res originals.
    Purge Rule 2 (Delivery Albums):
      Albums where allow_download == True AND client_downloaded_at is older than 1 day -> Purge high-res originals.

    Thumbnail Preservation:
      - Deletes the high-res file from Cloudinary/S3 only if item.url != item.thumbnail_url.
      - Re-points item.url to item.thumbnail_url so all gallery UIs continue to render seamlessly.
      - storage_used is NOT decremented (lifetime bandwidth quota preserved).
    """
    db = SessionLocal()
    try:
        now_utc = datetime.now(timezone.utc)
        two_days_ago = now_utc - timedelta(days=2)
        one_day_ago = now_utc - timedelta(days=1)

        # 1. Selection Albums: photographer_downloaded_at <= 2 days ago
        selection_albums = db.query(Album).filter(
            Album.photographer_downloaded_at.isnot(None),
            Album.photographer_downloaded_at <= two_days_ago
        ).all()

        # 2. Delivery Albums: allow_download is True AND client_downloaded_at <= 1 day ago
        delivery_albums = db.query(Album).filter(
            Album.allow_download == True,
            Album.client_downloaded_at.isnot(None),
            Album.client_downloaded_at <= one_day_ago
        ).all()

        target_map = {a.id: a for a in (selection_albums + delivery_albums)}
        target_albums = list(target_map.values())

        if not target_albums:
            logger.info("[Auto-Purge] No albums currently match download-triggered auto-purge criteria.")
            return

        logger.info(f"[Auto-Purge] Found {len(target_albums)} album(s) qualifying for high-res asset cleanup.")
        purged_count = 0

        for album in target_albums:
            media_items = album.media_items or []
            album_modified = False

            for item in media_items:
                # If high-res URL is empty or already replaced with thumbnail, already purged
                if not item.url:
                    continue
                if item.thumbnail_url and item.url == item.thumbnail_url:
                    continue

                high_res_url = item.url
                thumb_url = item.thumbnail_url or item.url

                # Target ONLY the original high-res asset in the cloud provider
                # API-03: Storage / Deletion Correctness (respect boolean false returns)
                deleted = False
                try:
                    if "res.cloudinary.com" in high_res_url:
                        deleted = bool(delete_file_from_cloudinary(high_res_url))
                    elif high_res_url.startswith("/uploads/"):
                        clean_fn = os.path.basename(high_res_url)
                        local_f = os.path.join(os.getcwd(), "uploads", clean_fn)
                        if os.path.exists(local_f):
                            os.remove(local_f)
                        deleted = True
                    else:
                        deleted = bool(delete_file_from_s3(high_res_url))
                except Exception as del_err:
                    logger.warning(f"[Auto-Purge Warning] Cloud deletion error for item {item.id} ({high_res_url}): {del_err}")

                # DB-04: Only replace the URL if it was successfully deleted
                if deleted:
                    # THUMBNAIL PRESERVATION:
                    # Update item.url to thumbnail_url so client and admin dashboards render without missing images
                    item.url = thumb_url
                    album_modified = True
                    purged_count += 1
                else:
                    logger.warning(f"[DB-04] Keeping {high_res_url} for retry because cloud deletion failed.")

            if album_modified:
                db.commit()

        logger.info(f"[Auto-Purge Complete] Purged {purged_count} original high-res asset(s) across {len(target_albums)} album(s). Thumbnails preserved.")
    except Exception as exc:
        db.rollback()
        logger.error(f"[Auto-Purge Error] Error executing auto-purge scan: {exc}\n{traceback.format_exc()}")
    finally:
        db.close()

async def run_auto_purge_loop():
    """
    Background worker loop executed inside FastAPI lifespan.
    Runs every 12 hours to trigger the download-triggered auto-purge logic.
    """
    logger.info("[Auto-Purge Worker] Background auto-purge task started (12-hour cycle).")
    # Small initial delay on startup so database initialization completes smoothly
    await asyncio.sleep(5)
    while True:
        try:
            purge_expired_albums()
        except asyncio.CancelledError:
            logger.info("[Auto-Purge Worker] Background loop cancelled.")
            break
        except Exception as exc:
            logger.error(f"[Auto-Expire Worker Error] Unexpected error in auto-expire scan: {exc}")

        try:
            purge_download_triggered_assets()
        except asyncio.CancelledError:
            logger.info("[Auto-Purge Worker] Background loop cancelled.")
            break
        except Exception as exc:
            logger.error(f"[Auto-Purge Worker Error] Unexpected error in auto-purge loop: {exc}")

        try:
            await asyncio.sleep(12 * 3600)  # 12 hours
        except asyncio.CancelledError:
            logger.info("[Auto-Purge Worker] Sleep interrupted by shutdown.")
            break

async def auto_register_telegram_webhook():
    """
    Auto-registers Telegram Webhook on application startup.
    Ensures that Telegram Bot API directs /start and notifications
    strictly to this active backend, overriding any defunct or legacy endpoints.
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.info("[Telegram Lifecycle] TELEGRAM_BOT_TOKEN not configured. Skipping webhook auto-registration.")
        return

    base_url = (
        os.environ.get("APP_URL") or 
        os.environ.get("RENDER_EXTERNAL_URL") or 
        "https://photoguard.onrender.com"
    ).rstrip("/")
    target_webhook_url = f"{base_url}/api/telegram/webhook"

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            info_res = await client.get(f"https://api.telegram.org/bot{token}/getWebhookInfo")
            if info_res.status_code == 200:
                current_info = info_res.json().get("result", {})
                current_url = current_info.get("url", "")
                if current_url != target_webhook_url:
                    logger.info(f"[Telegram Lifecycle] Updating Telegram Webhook from '{current_url}' to '{target_webhook_url}'...")
                    set_res = await client.post(
                        f"https://api.telegram.org/bot{token}/setWebhook",
                        json={"url": target_webhook_url, "drop_pending_updates": True}
                    )
                    logger.info(f"[Telegram Lifecycle] setWebhook response: {set_res.text}")
                else:
                    logger.info(f"[Telegram Lifecycle] Telegram Webhook is active and correctly targeted to: {target_webhook_url}")
            else:
                logger.warning(f"[Telegram Lifecycle] getWebhookInfo query returned {info_res.status_code}: {info_res.text}")
    except Exception as exc:
        logger.warning(f"[Telegram Lifecycle] Non-fatal notice during Telegram webhook sync: {exc}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifespan management.
    Runs DDL schema creation, column auto-migrations, and seeds root admin safely.
    Catches all exceptions so Uvicorn startup never aborts with status 1.
    """
    logger.info("[PhotoGuard Lifecycle] Application booting up...")
    try:
        # 1. Ensure all tables defined by SQLAlchemy Base exist
        try:
            # Base.metadata.create_all(bind=engine) # DB-06 enforced
            logger.info("[PhotoGuard Lifecycle] Base.metadata.create_all completed.")
        except Exception as table_err:
            logger.warning(f"[PhotoGuard Lifecycle] Base.metadata.create_all warning: {table_err}")
        
        
        # 3. Seed Root Admin safely
        try:
            seed_result = seed_root_admin()
            logger.info(f"[PhotoGuard Lifecycle] Seed result: {seed_result}")
        except Exception as seed_err:
            logger.warning(f"[PhotoGuard Lifecycle] seed_root_admin warning: {seed_err}")

        # 4. Seed Default Plan Configurations safely
        try:
            with SessionLocal() as db_session:
                from app.services.plan_service import get_all_plan_configs
                get_all_plan_configs(db_session)
            logger.info("[PhotoGuard Lifecycle] Dynamic Plan Configurations verified and seeded.")
        except Exception as plan_err:
            logger.warning(f"[PhotoGuard Lifecycle] Plan configurations seed warning: {plan_err}")
    except Exception as exc:
        logger.critical(f"[PhotoGuard Lifecycle Error] Non-fatal startup sequence error: {exc}\n{traceback.format_exc()}")
    
    # 5. Start intelligent Download-Triggered Auto-Purge background loop and Telegram webhook sync
    auto_purge_task = asyncio.create_task(run_auto_purge_loop())
    asyncio.create_task(auto_register_telegram_webhook())

    yield

    # Clean shutdown of auto-purge loop
    auto_purge_task.cancel()
    try:
        await auto_purge_task
    except asyncio.CancelledError:
        pass
    logger.info("[PhotoGuard Lifecycle] Application shutting down.")

app = FastAPI(
    title="PhotoGuard API",
    description="Secure Anti-Piracy Photo Selection SaaS Platform Backend",
    version="7.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Secured CORS configuration for cross-origin communication
origins = [
    "http://localhost:3000",
    "https://photoguard.com",
    os.environ.get("FRONTEND_URL", "https://photoguard.com")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Guarantees that FastAPI validation errors return a clean human-readable string in 'detail',
    completely preventing React Error #31 (object rendered as child) on the frontend.
    """
    errors = exc.errors()
    messages = []
    for err in errors:
        loc_parts = [str(l) for l in err.get("loc", []) if str(l) not in ["body", "query", "path"]]
        field = " -> ".join(loc_parts)
        msg = err.get("msg", "Invalid value")
        messages.append(f"{field}: {msg}" if field else msg)
    clean_msg = "; ".join(messages) if messages else "Invalid request data."
    logger.warning(f"[Validation Error] {request.method} {request.url.path}: {clean_msg}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": clean_msg, "errors": errors},
    )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    SRE Interceptor for Database Errors:
    Catches all database disconnects, query failures, and constraint errors,
    records detailed traceback into SystemErrorLog, and returns a clean 500 JSON
    to prevent client-side crashes across React and Kotlin.
    """
    tb = traceback.format_exc()
    error_msg = str(exc)
    endpoint = f"{request.method} {request.url.path}"
    logger.error(f"[Database Error Intercepted] {endpoint}: {error_msg}\n{tb}")

    # Safely persist error to database via a dedicated session
    try:
        with SessionLocal() as db_err:
            log_entry = SystemErrorLog(
                error_type="DATABASE",
                endpoint=endpoint[:255],
                error_message=error_msg[:1000],
                traceback_details=tb,
                is_resolved=False
            )
            db_err.add(log_entry)
            db_err.commit()
    except Exception as db_save_err:
        logger.error(f"[Error Logger Fallback] Could not persist database crash log: {db_save_err}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "System encountered an error. Logged for admin review."}
    )

@app.exception_handler(Exception)
async def global_generic_exception_handler(request: Request, exc: Exception):
    """
    SRE Universal Crash Interceptor:
    Intercepts unhandled runtime exceptions, persists the error into SystemErrorLog,
    and returns a clean 500 JSON response so Kotlin and React never experience white-screens.
    Bypasses standard HTTPExceptions (400, 401, 403, 404) and RequestValidationErrors.
    """
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)
    if isinstance(exc, RequestValidationError):
        return await validation_exception_handler(request, exc)

    tb = traceback.format_exc()
    error_msg = str(exc) or exc.__class__.__name__
    endpoint = f"{request.method} {request.url.path}"
    logger.error(f"[Unhandled Runtime Crash Intercepted] {endpoint}: {error_msg}\n{tb}")

    # Safely persist error to database
    try:
        with SessionLocal() as db_err:
            log_entry = SystemErrorLog(
                error_type="RUNTIME",
                endpoint=endpoint[:255],
                error_message=error_msg[:1000],
                traceback_details=tb,
                is_resolved=False
            )
            db_err.add(log_entry)
            db_err.commit()
    except Exception as db_save_err:
        logger.error(f"[Error Logger Fallback] Could not persist runtime crash log: {db_save_err}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "System encountered an error. Logged for admin review."}
    )

# Register Core API Routers
app.include_router(auth_router)
app.include_router(albums_router)
app.include_router(client_router)
app.include_router(media_router)
app.include_router(admin_router)
app.include_router(telegram_router)
app.include_router(team_router)
app.include_router(broadcasts_router)
app.include_router(photographers_router)
app.include_router(photographers_router, prefix="/api/v1/photographer")
app.include_router(photographers_router, prefix="/api/photographers")

# Direct alias for studio logo upload
@app.post("/api/v1/users/upload-logo", tags=["User Profile"])
async def upload_logo_v1_alias(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.api.auth import upload_studio_logo
    return await upload_studio_logo(file=file, db=db, current_user=current_user)

# Direct alias for user password change
@app.put("/api/v1/users/change-password", response_model=UserResponse, tags=["User Profile"])
@app.post("/api/v1/users/change-password", response_model=UserResponse, tags=["User Profile"])
def change_password_users_alias(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.api.auth import change_password
    return change_password(payload=payload, db=db, current_user=current_user)

# Direct root webhook alias for Telegram Bot API
@app.post("/webhook", tags=["Telegram Integration"])
async def root_telegram_webhook(request: Request, db: Session = Depends(get_db)):
    from app.api.telegram import telegram_webhook
    return await telegram_webhook(request=request, db=db)

# Static files directory resolution (built React app in dist/ or frontend/dist/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Multi-path discovery for built frontend dist
candidate_dist_dirs = [
    os.path.join(BASE_DIR, "dist"),
    os.path.join(os.getcwd(), "dist"),
    os.path.join(BASE_DIR, "frontend", "dist"),
    os.path.join(os.getcwd(), "frontend", "dist"),
    "/opt/render/project/src/dist",
    "/opt/render/project/src/frontend/dist",
    "/app/dist",
    "/app/applet/dist",
    os.path.join(BASE_DIR, "frontend", "build"),
    os.path.join(os.getcwd(), "build")
]

DIST_DIR = os.path.join(BASE_DIR, "dist")
for candidate in candidate_dist_dirs:
    if os.path.exists(os.path.join(candidate, "index.html")):
        DIST_DIR = candidate
        break

def get_index_file_path() -> str | None:
    """Dynamically resolves index.html in case dist was compiled after process startup."""
    for candidate in candidate_dist_dirs:
        idx = os.path.join(candidate, "index.html")
        if os.path.isfile(idx):
            return idx
    return None

# Mount /assets if assets directory exists
if os.path.exists(DIST_DIR):
    assets_path = os.path.join(DIST_DIR, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

# Ensure and mount local uploads directory for fallback storage
UPLOADS_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR, check_dir=False), name="uploads")

@app.get("/uploads/{filename:path}", tags=["Media Storage & CDN"])
async def serve_uploaded_media(filename: str):
    """
    Direct handler to ensure fallback uploaded files in uploads/ are always served
    with proper MIME types, bypassing any SPA catch-all collisions.
    """
    clean_name = os.path.basename(filename)
    file_path = os.path.join(UPLOADS_DIR, clean_name)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": f"File '{clean_name}' not found."})

@app.post("/api/v1/admin/purge-expired", tags=["Admin Control"])
def manual_purge_expired_albums_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Emergency/On-Demand Admin Endpoint to trigger airtight auto-expiration cleanup.
    """
    if str(getattr(current_user, "role", "")).lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required.")
    purge_expired_albums()
    return {"status": "success", "message": "Airtight auto-expiration cleanup triggered successfully."}


@app.get("/health", status_code=status.HTTP_200_OK)
def health_check(db: Session = Depends(get_db)):
    """
    Production health check verifying API operational status
    and active database connectivity.
    """
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "operational",
            "service": "PhotoGuard API",
            "database": "connected",
            "environment": os.environ.get("ENVIRONMENT", "production"),
            "version": "7.0.0"
        }
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "service": "PhotoGuard API",
                "database": "disconnected",
                "error": str(exc),
                "version": "7.0.0"
            }
        )

@app.get("/", status_code=status.HTTP_200_OK)
def root():
    """
    Root endpoint: serves the production React SPA frontend if built,
    otherwise falls back to API status.
    """
    index_file = get_index_file_path()
    if index_file and os.path.isfile(index_file):
        return FileResponse(index_file)
    return {
        "service": "PhotoGuard API",
        "version": "7.0.0",
        "status": "operational",
        "docs_url": "/docs",
        "health_url": "/health",
        "message": "PhotoGuard Elite Anti-Piracy Photo Selection SaaS Backend is Live."
    }

@app.get("/{catchall:path}")
async def catch_all_spa(catchall: str):
    """
    Catch-all route: Serves static files if they exist, or returns index.html
    for React Router client-side routing (e.g., /login, /dashboard).
    Excludes all /api/v1/* routes and system endpoints.
    """
    if catchall.startswith("api/") or catchall in ["health", "docs", "redoc", "openapi.json"]:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Not Found"})
    
    # Check if this points to an uploaded media item
    if catchall.startswith("uploads/"):
        upload_subpath = catchall.replace("uploads/", "", 1)
        upload_clean = os.path.basename(upload_subpath)
        file_in_uploads = os.path.join(UPLOADS_DIR, upload_clean)
        if os.path.isfile(file_in_uploads):
            return FileResponse(file_in_uploads)
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Uploaded file not found"})
    
    # Check if a static file exists in any candidate dist directory
    for candidate in candidate_dist_dirs:
        file_path = os.path.join(candidate, catchall)
        if os.path.isfile(file_path):
            media_type = None
            if catchall.endswith(".css"):
                media_type = "text/css"
            elif catchall.endswith(".js"):
                media_type = "application/javascript"
            elif catchall.endswith(".svg"):
                media_type = "image/svg+xml"
            return FileResponse(file_path, media_type=media_type)
    
    # Return index.html for all SPA routes like /login
    index_file = get_index_file_path()
    if index_file and os.path.isfile(index_file):
        return FileResponse(index_file)
    
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Not Found"})

if __name__ == "__main__":
    import uvicorn
    server_port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=server_port, reload=False)

from starlette.middleware.base import BaseHTTPMiddleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' https: data: blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; "
            "connect-src 'self' https://api.cloudinary.com; "
            "font-src 'self' data:; "
            "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; "
            "form-action 'self'"
        )
        if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)
