import os
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import engine, Base, get_db
from app.models.user import User
from app.models.album import Album, MediaItem
from app.api.auth import router as auth_router
from app.api.albums import router as albums_router

# Synchronize model definitions with database schema upon startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PhotoGuard API",
    description="Secure Anti-Piracy Photo Selection SaaS Platform Backend",
    version="7.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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
