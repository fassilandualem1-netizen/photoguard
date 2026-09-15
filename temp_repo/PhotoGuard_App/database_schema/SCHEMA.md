# PhotoGuard Database & Storage Schema

## 1. Clean Project Architecture
We have successfully refactored the project into a single, unified structure:

```
PhotoGuard_App/
│
├── frontend/             # React (Vite) UI - Separated logic from core
│   ├── src/              # App.tsx, styles, and UI components
│   └── server.ts         # Fast UI proxy & Static Asset Server
│
├── backend_api/          # Python Core API (The "Heart")
│   ├── fastapi_core/     # NEW: Scalable FastAPI Module
│   │   ├── main.py       # FastAPI Entrypoint (Photographer/Client integration)
│   │   ├── models.py     # SQLAlchemy Database Models (Schema)
│   │   └── storage.py    # Cloudinary & AWS S3 Multi-Cloud Integration
│   └── ...               # Legacy Flask integrations & utilities
│
├── mobile_app/           # Android Kotlin/Compose Application
│   └── ...               # Mobile app codebase
│
└── database_schema/      # Documentation
    └── SCHEMA.md         # You are here
```

## 2. Database Schema (FastAPI / SQLAlchemy)
Inside `PhotoGuard_App/backend_api/fastapi_core/models.py`, we track all information clearly:

* **Users:** `id`, `email`, `hashed_password`, `role` (Admin/Photographer)
* **Albums:** `id`, `name`, `code` (e.g. `6A9B2C`), `photographer_id`, `expires_at`
* **Photos:**
  * `filename`: The original file name
  * `watermarked_url`: Publicly accessible Cloudinary URL (Low-Res + Watermarked)
  * `secure_s3_url`: Private AWS S3 reference (Original, High-Res)
  * `is_selected`: Client selection flag

## 3. Multi-Cloud Storage Architecture

The FastAPI storage logic (`fastapi_core/storage.py`) implements a secure dual-upload strategy to prevent piracy:

### A) Cloudinary (For Speed & Watermarking)
When a photographer uploads a photo, it goes to Cloudinary which automatically scales it down (e.g., max 1080px width) and slaps a **PhotoGuard text watermark** over it. This CDN URL is used by the Client Dashboard for fast, safe previews.

### B) AWS S3 (For Secure Original Storage)
The original, unwatermarked high-resolution file is sent to an **AWS S3 Private Bucket**. This bucket restricts public read access. When a client finally purchases or the photographer approves the gallery, the API generates a **Presigned URL** (valid for 30 minutes) to download the ZIP file.

### C) Google Drive & ImageKit Note
*ImageKit* is an excellent alternative to Cloudinary and is completely supported by swapping the URL transformation structure.
*Google Drive* is NOT recommended for client galleries due to strict rate limits. It is reserved for background archiving only.
