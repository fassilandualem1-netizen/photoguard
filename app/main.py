import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
            
            # Safe table creation for PaymentReceipts (Telebirr/CBE manual upgrade workflow)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS payment_receipts (
                    id SERIAL PRIMARY KEY,
                    photographer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    transaction_ref VARCHAR(100) UNIQUE NOT NULL,
                    amount DOUBLE PRECISION NOT NULL,
                    payment_method VARCHAR(50) DEFAULT 'telebirr',
                    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
                );
            """))
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

if __name__ == "__main__":
    import uvicorn
    server_port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=server_port, reload=False)
