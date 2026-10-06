import os
import asyncio
import logging
import traceback
from datetime import datetime, timezone, timedelta
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


def seed_root_admin():
    """
    Secure Admin Seeder.
    - Reads ADMIN_EMAIL and ADMIN_PASSWORD from os.environ.
    - Requires both to be present; no unsafe fallbacks.
    - Preserves existing admin passwords and state.
    """
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "")

    if not admin_email or not admin_pw:
        logger.warning("[PhotoGuard Seeder] ADMIN_EMAIL or ADMIN_PASSWORD not configured. Skipping admin seed.")
        return {"success": False, "reason": "admin credentials not configured"}

    try:
        new_hash = get_password_hash(admin_pw.strip())
    except Exception as hash_err:
        logger.error(f"[PhotoGuard Seeder Error] Failed to hash password: {hash_err}")
        return {"success": False, "reason": "hashing_failed"}

    try:
        with SessionLocal() as db:
            existing_admin = db.query(User).filter(User.email == admin_email).first()
            if existing_admin:
                if existing_admin.role != UserRole.ADMIN.value:
                    existing_admin.role = UserRole.ADMIN.value
                    existing_admin.is_active = True
                    existing_admin.is_verified = True
                    db.commit()
                return {"success": True, "action": "existing_admin_preserved"}
            else:
                new_admin = User(
                    email=admin_email,
                    hashed_password=new_hash,
                    full_name="System Administrator",
                    role=UserRole.ADMIN.value,
                    is_active=True,
                    is_verified=True,
                    needs_password_change=False
                )
                db.add(new_admin)
                db.commit()
                return {"success": True, "action": "admin_created"}
    except Exception as final_err:
        logger.error(f"[PhotoGuard Seeder Error] Database failure during seed: {final_err}")
        return {"success": False, "error": str(final_err)}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifespan management.
    Runs DDL schema creation, column auto-migrations, and seeds root admin safely.
    Catches all exceptions so Uvicorn startup never aborts with status 1.
    """
    logger.info("[PhotoGuard Lifecycle] Application booting up...")
    try:
        # 1. Database schema is now fully managed by Alembic Migrations.
        # Removed Base.metadata.create_all() to enforce strict DB-06 migration integrity.
        
        
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
    
    # 5. Start intelligent Download-Triggered Auto-Purge background loop
    auto_purge_task = asyncio.create_task(run_auto_purge_loop())

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
            return FileResponse(file_path)
    
    # Return index.html for all SPA routes like /login
    index_file = get_index_file_path()
    if index_file and os.path.isfile(index_file):
        return FileResponse(index_file)
    
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Not Found"})

if __name__ == "__main__":
    import uvicorn
    server_port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=server_port, reload=False)
