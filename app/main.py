import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import engine, Base, get_db
from app.models.user import User
from app.models.album import Album, MediaItem
from app.models.payment import PaymentReceipt
from app.api.auth import router as auth_router
from app.api.albums import router as albums_router
from app.api.client import router as client_router
from app.api.media import router as media_router
from app.api.admin import router as admin_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifespan management.
    Performs auto-migration to ensure new schema columns and tables exist safely
    without dropping existing tables on free-tier PostgreSQL.
    """
    # Safe auto-migration for zero-downtime deployments
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'basic';"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_password_change BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("ALTER TABLE albums ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;"))
            
            # Safe table creation & migration for PaymentReceipts (Telebirr/CBE manual upgrade workflow)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS payment_receipts (
                    id SERIAL PRIMARY KEY,
                    photographer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    transaction_ref VARCHAR(100),
                    amount DOUBLE PRECISION,
                    payment_method VARCHAR(50) DEFAULT 'telebirr',
                    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
                );
            """))
            conn.execute(text("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(100);"))
            conn.execute(text("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS amount DOUBLE PRECISION;"))
            conn.execute(text("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'telebirr';"))
            conn.execute(text("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';"))
            conn.execute(text("ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_payment_receipts_transaction_ref ON payment_receipts(transaction_ref);"))
    except Exception as exc:
        print(f"Auto-migration notice: {exc}")
    yield

# Synchronize model definitions with database schema upon startup
Base.metadata.create_all(bind=engine)

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

# Register Core API Routers
app.include_router(auth_router)
app.include_router(albums_router)
app.include_router(client_router)
app.include_router(media_router)
app.include_router(admin_router)

# Static files directory resolution (built React app in dist/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(BASE_DIR, "dist")
if not os.path.exists(DIST_DIR):
    DIST_DIR = os.path.join(os.getcwd(), "dist")

# Mount /assets if dist/assets exists
assets_path = os.path.join(DIST_DIR, "assets")
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

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
            "environment": os.getenv("ENVIRONMENT", "production"),
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
