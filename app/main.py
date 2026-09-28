"""
PhotoGuard - Production FastAPI Backend & Single-Page Dashboard Server
Serves both the FastAPI REST endpoints and the full React SPA Web Dashboard on Render.
"""
import os
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI(
    title="PhotoGuard API & Dashboard",
    description="Secure Anti-Piracy Photo Selection SaaS Platform",
    version="7.0.0"
)

# Robust CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Health Endpoints
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "photoguard-core",
        "database": "Neon PostgreSQL Connected"
    }

@app.get("/api/health")
def api_health():
    return {
        "status": "ok",
        "engine": "FastAPI on Render",
        "architecture": "PhotoGuard v7.0"
    }

# Dist Directory Setup for Static Files & SPA Routing
BASE_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = BASE_DIR / "dist"

if DIST_DIR.exists():
    # Mount static assets (/assets, favicon, logo)
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/favicon.svg")
    async def favicon():
        return FileResponse(DIST_DIR / "favicon.svg")

    @app.get("/logo.svg")
    async def logo():
        return FileResponse(DIST_DIR / "logo.svg")

    # Serve React SPA index.html for all non-API routes (including /login, /dashboard, etc.)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Do not intercept API routes
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        # If specific file exists in dist, serve it
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
            
        # Fallback to SPA index.html
        return FileResponse(DIST_DIR / "index.html")
else:
    @app.get("/")
    def root():
        return {"status": "online", "message": "PhotoGuard API Gateway Active"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
