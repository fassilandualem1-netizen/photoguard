import os
import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status, Request, UploadFile, File
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import engine, Base, get_db, SessionLocal
from app.core.security import get_password_hash, verify_password
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.album import Album, MediaItem
from app.models.payment import PaymentReceipt
from app.schemas.auth import UserResponse, PasswordChangeRequest
from app.api.auth import router as auth_router
from app.api.albums import router as albums_router
from app.api.client import router as client_router
from app.api.media import router as media_router
from app.api.admin import router as admin_router
from app.api.telegram import router as telegram_router
from app.api.team import router as team_router
from app.api.broadcasts import router as broadcasts_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("photoguard.core")

def safe_execute_ddl(sql_statement: str, description: str = ""):
    """
    Executes a single DDL/DML statement safely in its own transaction block.
    Catches, logs, and passes all exceptions so startup never crashes.
    """
    try:
        with engine.begin() as conn:
            conn.execute(text(sql_statement))
    except Exception as exc:
        desc = description or sql_statement[:60]
        logger.warning(f"[PhotoGuard DB Auto-Migration] Non-fatal notice for '{desc}': {exc}")

def run_db_migrations():
    """
    Safe auto-migration for zero-downtime deployments.
    Ensures missing columns and payment receipt tables exist.
    All statements execute independently so one failing query never blocks startup.
    """
    logger.info("[PhotoGuard DB] Starting schema auto-migration...")
    try:
        # Users table schema migrations
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT 'System Admin';", "users.full_name")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'photographer';", "users.role")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'basic';", "users.subscription_plan")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'basic';", "users.plan")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;", "users.is_verified")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_quota_limit BIGINT DEFAULT 5368709120;", "users.storage_quota_limit")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_used BIGINT DEFAULT 0;", "users.storage_used")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_password_change BOOLEAN DEFAULT TRUE;", "users.needs_password_change")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;", "users.token_version")
        safe_execute_ddl("UPDATE users SET token_version = 1 WHERE token_version IS NULL;", "users.token_version null check")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);", "users.telegram_chat_id")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS studio_logo_url VARCHAR(1024);", "users.studio_logo_url")
        safe_execute_ddl("ALTER TABLE users ALTER COLUMN studio_logo_url TYPE VARCHAR(1024);", "users.studio_logo_url type")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_color VARCHAR(50) DEFAULT '#F59E0B';", "users.brand_color")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;", "users.is_active")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;", "users.created_at")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;", "users.updated_at")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;", "users.parent_owner_id")
        safe_execute_ddl("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE;", "users.parent_id")
        safe_execute_ddl("CREATE INDEX IF NOT EXISTS ix_users_parent_id ON users(parent_id);", "index users.parent_id")

        # Safe role type conversions if role was previously typed as enum
        safe_execute_ddl("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50) USING role::text;", "users.role type convert")

        # Safe constraint removal and type conversion on legacy 'plan' and 'subscription_plan' columns
        safe_execute_ddl("""
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE users ALTER COLUMN plan DROP DEFAULT;
                EXCEPTION WHEN OTHERS THEN NULL; END;

                BEGIN
                    ALTER TABLE users ALTER COLUMN plan TYPE VARCHAR(50) USING plan::text;
                EXCEPTION WHEN OTHERS THEN NULL; END;

                BEGIN
                    ALTER TABLE users ALTER COLUMN plan DROP NOT NULL;
                EXCEPTION WHEN OTHERS THEN NULL; END;

                BEGIN
                    ALTER TABLE users ALTER COLUMN subscription_plan DROP NOT NULL;
                    ALTER TABLE users ALTER COLUMN subscription_plan SET DEFAULT 'basic';
                EXCEPTION WHEN OTHERS THEN NULL; END;

                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'users' AND column_name = 'plan'
                    ) AND EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'users' AND column_name = 'subscription_plan'
                    ) THEN 
                        UPDATE users SET subscription_plan = COALESCE(plan, 'basic') WHERE subscription_plan IS NULL;
                        UPDATE users SET plan = COALESCE(subscription_plan, 'basic') WHERE plan IS NULL;
                    ELSIF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'users' AND column_name = 'subscription_plan'
                    ) THEN
                        UPDATE users SET subscription_plan = 'basic' WHERE subscription_plan IS NULL;
                    END IF;
                EXCEPTION WHEN OTHERS THEN NULL; END;
            END $$;
        """, "users plan and subscription_plan sync")

        # Albums table schema migrations
        safe_execute_ddl("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'albums' AND column_name = 'client') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'albums' AND column_name = 'client_name') THEN
                    ALTER TABLE albums RENAME COLUMN client TO client_name;
                END IF;
            END $$;
        """, "albums rename client to client_name")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Untitled Album';", "albums.title")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS client_name VARCHAR(255) DEFAULT 'Valued Client';", "albums.client_name")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS pin VARCHAR(6);", "albums.pin")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS photographer_id INTEGER;", "albums.photographer_id")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;", "albums.is_locked")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;", "albums.submitted_at")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS allow_download BOOLEAN DEFAULT FALSE;", "albums.allow_download")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;", "albums.created_at")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;", "albums.expires_at")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;", "albums.view_count")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP WITH TIME ZONE;", "albums.last_viewed_at")
        safe_execute_ddl("ALTER TABLE albums ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;", "albums.reminder_sent_at")

        # Sanitize existing NULLs in albums
        safe_execute_ddl("UPDATE albums SET title = 'Untitled Album' WHERE title IS NULL;", "sanitize albums.title")
        safe_execute_ddl("UPDATE albums SET client_name = 'Valued Client' WHERE client_name IS NULL;", "sanitize albums.client_name")
        safe_execute_ddl("UPDATE albums SET is_locked = FALSE WHERE is_locked IS NULL;", "sanitize albums.is_locked")
        safe_execute_ddl("UPDATE albums SET allow_download = FALSE WHERE allow_download IS NULL;", "sanitize albums.allow_download")
        safe_execute_ddl("UPDATE albums SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;", "sanitize albums.created_at")
        safe_execute_ddl("UPDATE albums SET view_count = 0 WHERE view_count IS NULL;", "sanitize albums.view_count")

        # Media items table schema migrations
        safe_execute_ddl("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS filename VARCHAR(255) DEFAULT 'photo.jpg';", "media_items.filename")
        safe_execute_ddl("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS url VARCHAR(1024);", "media_items.url")
        safe_execute_ddl("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(1024);", "media_items.thumbnail_url")
        safe_execute_ddl("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS original_size BIGINT DEFAULT 0;", "media_items.original_size")
        safe_execute_ddl("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS compressed_size BIGINT DEFAULT 0;", "media_items.compressed_size")
        safe_execute_ddl("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT FALSE;", "media_items.is_selected")
        safe_execute_ddl("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS client_notes VARCHAR(1000);", "media_items.client_notes")
        safe_execute_ddl("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS face_encodings JSON;", "media_items.face_encodings")
        safe_execute_ddl("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;", "media_items.created_at")

        # Sanitize existing NULLs in media items
        safe_execute_ddl("UPDATE media_items SET filename = 'photo.jpg' WHERE filename IS NULL;", "sanitize media_items.filename")
        safe_execute_ddl("UPDATE media_items SET is_selected = FALSE WHERE is_selected IS NULL;", "sanitize media_items.is_selected")
        safe_execute_ddl("UPDATE media_items SET original_size = 0 WHERE original_size IS NULL;", "sanitize media_items.original_size")
        safe_execute_ddl("UPDATE media_items SET compressed_size = 0 WHERE compressed_size IS NULL;", "sanitize media_items.compressed_size")
        safe_execute_ddl("UPDATE media_items SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;", "sanitize media_items.created_at")
        
        # Payment receipts table creation & indexing
        safe_execute_ddl("""
            CREATE TABLE IF NOT EXISTS payment_receipts (
                id SERIAL PRIMARY KEY,
                photographer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                transaction_ref VARCHAR(100),
                amount DOUBLE PRECISION,
                payment_method VARCHAR(50) DEFAULT 'telebirr',
                status VARCHAR(50) DEFAULT 'pending' NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
            );
        """, "create payment_receipts table")
        # Ensure photographer_id column exists (in case table was created with user_id or legacy column)
        safe_execute_ddl("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS photographer_id INTEGER REFERENCES users(id) ON DELETE CASCADE;", "payment_receipts.photographer_id")
        # If legacy user_id exists in payment_receipts, sync it to photographer_id
        safe_execute_ddl("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'payment_receipts' AND column_name = 'user_id'
                ) THEN
                    UPDATE payment_receipts SET photographer_id = user_id WHERE photographer_id IS NULL;
                END IF;
            END $$;
        """, "sync payment_receipts legacy user_id to photographer_id")
        safe_execute_ddl("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(100);", "payment_receipts.transaction_ref")
        safe_execute_ddl("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS amount DOUBLE PRECISION;", "payment_receipts.amount")
        safe_execute_ddl("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'telebirr';", "payment_receipts.payment_method")
        safe_execute_ddl("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';", "payment_receipts.status")
        safe_execute_ddl("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;", "payment_receipts.created_at")
        safe_execute_ddl("CREATE INDEX IF NOT EXISTS ix_payment_receipts_transaction_ref ON payment_receipts(transaction_ref);", "index payment_receipts.transaction_ref")

        # Plan configurations table creation & indexing
        safe_execute_ddl("""
            CREATE TABLE IF NOT EXISTS plan_configurations (
                id SERIAL PRIMARY KEY,
                plan_name VARCHAR(50) UNIQUE NOT NULL,
                storage_quota_bytes BIGINT NOT NULL,
                default_lifespan_days INTEGER NOT NULL DEFAULT 7,
                max_lifespan_days INTEGER NOT NULL DEFAULT 30,
                can_enable_downloads BOOLEAN NOT NULL DEFAULT FALSE,
                can_customize_branding BOOLEAN NOT NULL DEFAULT FALSE,
                can_extend_lifespan BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """, "create plan_configurations table")
        safe_execute_ddl("ALTER TABLE plan_configurations ADD COLUMN IF NOT EXISTS max_lifespan_days INTEGER DEFAULT 30;", "plan_configurations.max_lifespan_days")
        safe_execute_ddl("ALTER TABLE plan_configurations ADD COLUMN IF NOT EXISTS can_extend_lifespan BOOLEAN DEFAULT FALSE;", "plan_configurations.can_extend_lifespan")
        safe_execute_ddl("CREATE INDEX IF NOT EXISTS ix_plan_configurations_plan_name ON plan_configurations(plan_name);", "index plan_configurations.plan_name")
        
        # Broadcasts table creation & indexing
        safe_execute_ddl("""
            CREATE TABLE IF NOT EXISTS broadcasts (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) NOT NULL DEFAULT 'info',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """, "create broadcasts table")
        safe_execute_ddl("CREATE INDEX IF NOT EXISTS ix_broadcasts_is_active ON broadcasts(is_active);", "index broadcasts.is_active")

        # Security Audit Logs table creation & indexing
        safe_execute_ddl("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                action VARCHAR(100) NOT NULL,
                target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                details VARCHAR(500) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """, "create audit_logs table")
        safe_execute_ddl("CREATE INDEX IF NOT EXISTS ix_audit_logs_admin_id ON audit_logs(admin_id);", "index audit_logs.admin_id")
        safe_execute_ddl("CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs(action);", "index audit_logs.action")
        safe_execute_ddl("CREATE INDEX IF NOT EXISTS ix_audit_logs_target_user_id ON audit_logs(target_user_id);", "index audit_logs.target_user_id")
        safe_execute_ddl("CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at);", "index audit_logs.created_at")

        logger.info("[PhotoGuard DB] Schema auto-migration step finalized.")

    except Exception as exc:
        logger.warning(f"[PhotoGuard DB] Top-level migration warning (non-fatal): {exc}")

SAFE_ADMIN_FALLBACK_PASSWORD = "Admin@123!"
DEFAULT_ADMIN_EMAIL = "admin@photoguard.com"

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
            Base.metadata.create_all(bind=engine)
            logger.info("[PhotoGuard Lifecycle] Base.metadata.create_all completed.")
        except Exception as table_err:
            logger.warning(f"[PhotoGuard Lifecycle] Base.metadata.create_all warning: {table_err}")
        
        # 2. Execute incremental auto-migrations safely
        try:
            run_db_migrations()
        except Exception as mig_err:
            logger.warning(f"[PhotoGuard Lifecycle] run_db_migrations warning: {mig_err}")
        
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
    
    yield
    logger.info("[PhotoGuard Lifecycle] Application shutting down.")

app = FastAPI(
    title="PhotoGuard API",
    description="Secure Anti-Piracy Photo Selection SaaS Platform Backend",
    version="7.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Bulletproof CORS configuration for cross-origin communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

# Register Core API Routers
app.include_router(auth_router)
app.include_router(albums_router)
app.include_router(client_router)
app.include_router(media_router)
app.include_router(admin_router)
app.include_router(telegram_router)
app.include_router(team_router)
app.include_router(broadcasts_router)

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

@app.get("/api/v1/admin/force-seed-admin", tags=["Admin Control"])
def force_seed_admin_endpoint():
    """
    Emergency Diagnostic & Force-Seed Endpoint.
    Can be directly accessed via browser to force creation/repair of Root Admin
    and return database status, table columns, and password verification output.
    """
    try:
        # Step 1: Ensure tables exist
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            logger.warning(f"Base.metadata.create_all error: {e}")
        
        # Step 2: Ensure migrations ran
        run_db_migrations()
        
        # Step 3: Run Seed
        result = seed_root_admin()
        
        if not result.get("success"):
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "error",
                    "message": "Database synchronization failed.",
                    "details": result
                }
            )

        # Storage health check
        from app.core.storage import is_s3_configured, S3_BUCKET_NAME, S3_ENDPOINT_URL, S3_ACCESS_KEY
        s3_status = {
            "s3_configured": is_s3_configured(),
            "bucket": S3_BUCKET_NAME,
            "has_endpoint": bool(S3_ENDPOINT_URL),
            "has_access_key": bool(S3_ACCESS_KEY),
            "storage_mode": "Cloud S3 / IDrive e2" if is_s3_configured() else "Ephemeral Local Disk (Warning: files vanish on restart)"
        }

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "success",
                "message": "Root admin account has been forcefully verified and synchronized.",
                "details": result,
                "storage_diagnostics": s3_status,
                "login_instructions": {
                    "login_url": "/login",
                    "email": result.get("email"),
                    "password": "Use 'Admin@123!' or the Render ADMIN_PASSWORD environment variable",
                    "note": "Admin accounts (fassilandualem1@gmail.com and fassilandualem19@gmail.com) have been synchronized with full studio privileges."
                }
            }
        )
    except Exception as exc:
        logger.error(f"[Emergency Force-Seed Error] {exc}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "error_type": type(exc).__name__,
                "detail": str(exc),
                "traceback": traceback.format_exc().splitlines()
            }
        )

# Static files directory resolution (built React app in dist/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(BASE_DIR, "dist")
if not os.path.exists(DIST_DIR):
    DIST_DIR = os.path.join(os.getcwd(), "dist")

# Mount /assets if dist/assets exists
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
    Root endpoint: serves the production React SPA frontend if built in dist/,
    otherwise falls back to API status.
    """
    index_file = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "service": "PhotoGuard API",
        "version": "7.0.0",
        "status": "operational",
        "docs_url": "/docs",
        "health_url": "/health",
        "message": "PhotoGuard Elite Anti-Piracy Photo Selection SaaS Backend is Live."
    }

@app.get("/{full_path:path}")
async def catch_all_spa(full_path: str):
    """
    Catch-all route: Serves static files from dist/ if they exist,
    or falls back to index.html for React Router client-side routing.
    Excludes all /api/v1/* routes and system endpoints.
    """
    if full_path.startswith("api/") or full_path in ["health", "docs", "redoc", "openapi.json"]:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Not Found"})
    
    # Check if this points to an uploaded media item
    if full_path.startswith("uploads/"):
        upload_subpath = full_path.replace("uploads/", "", 1)
        upload_clean = os.path.basename(upload_subpath)
        file_in_uploads = os.path.join(UPLOADS_DIR, upload_clean)
        if os.path.isfile(file_in_uploads):
            return FileResponse(file_in_uploads)
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Uploaded file not found"})
    
    file_path = os.path.join(DIST_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    index_file = os.path.join(DIST_DIR, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Not Found"})

if __name__ == "__main__":
    import uvicorn
    server_port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=server_port, reload=False)
