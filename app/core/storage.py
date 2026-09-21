import os
import uuid
import logging
from typing import Dict, Optional
import boto3
from botocore.client import Config
from fastapi import UploadFile
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader

load_dotenv()

logger = logging.getLogger("photoguard.storage")

# Cloudinary Permanent Cloud Storage Configuration
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

is_cloudinary_initialized = False
if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    try:
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True
        )
        is_cloudinary_initialized = True
        logger.info("[Storage] Cloudinary permanent storage initialized successfully.")
    except Exception as c_err:
        logger.warning(f"[Storage] Cloudinary init warning: {c_err}")

def is_cloudinary_configured() -> bool:
    """Checks whether valid Cloudinary credentials are provided in environment."""
    return bool(
        is_cloudinary_initialized or (
            os.getenv("CLOUDINARY_CLOUD_NAME") and
            os.getenv("CLOUDINARY_API_KEY") and
            os.getenv("CLOUDINARY_API_SECRET")
        )
    )

def upload_file_to_cloudinary(file_bytes: bytes, filename: str, folder: str = "photoguard_vault") -> Dict[str, str]:
    """
    Uploads photo buffer directly to Cloudinary permanent storage.
    Generates high-resolution secure URL and optimized thumbnail delivery URL.
    """
    if not is_cloudinary_configured():
        raise ValueError("Cloudinary credentials are not configured.")

    base_name = os.path.splitext(filename)[0]
    clean_base = "".join(c for c in base_name if c.isalnum() or c in ("-", "_")).strip()[:40]
    unique_public_id = f"{clean_base}_{uuid.uuid4().hex[:10]}"

    upload_result = cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        public_id=unique_public_id,
        resource_type="image",
        overwrite=True
    )

    secure_url = upload_result.get("secure_url")
    public_id = upload_result.get("public_id")

    # Generate responsive WebP thumbnail transformation on-the-fly
    thumbnail_url = secure_url
    if "/upload/" in secure_url:
        thumbnail_url = secure_url.replace(
            "/upload/",
            "/upload/c_limit,w_600,q_auto:good,f_auto/"
        )

    return {
        "high_res_url": secure_url,
        "thumbnail_url": thumbnail_url,
        "public_id": public_id
    }

def delete_file_from_cloudinary(public_id_or_url: str) -> bool:
    """
    Deletes an asset permanently from Cloudinary given its public_id or full secure URL.
    """
    if not is_cloudinary_configured() or not public_id_or_url:
        return False

    public_id = public_id_or_url
    if "res.cloudinary.com" in public_id_or_url:
        try:
            parts = public_id_or_url.split("/upload/")[-1].split("/")
            clean_parts = [
                p for p in parts
                if not p.startswith("v") and not (
                    p.startswith("c_") or p.startswith("w_") or p.startswith("q_")
                )
            ]
            full_path = "/".join(clean_parts)
            public_id = os.path.splitext(full_path)[0]
        except Exception as parse_err:
            logger.warning(f"Could not parse Cloudinary public_id from URL: {parse_err}")
            public_id = public_id_or_url

    try:
        res = cloudinary.uploader.destroy(public_id, resource_type="image")
        result_status = res.get("result")
        logger.info(f"[Cloudinary] Delete {public_id}: {result_status}")
        return result_status in ("ok", "not found")
    except Exception as exc:
        logger.warning(f"[Cloudinary] Error destroying asset {public_id}: {exc}")
        return False

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "photoguard-production")

CLOUDFLARE_CDN_DOMAIN = os.getenv("CLOUDFLARE_CDN_DOMAIN", "https://cdn.photoguard.com")
IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/photoguard")

# Local storage fallback directory
UPLOADS_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

_s3_client = None

def is_s3_configured() -> bool:
    """Checks whether valid S3/IDrive e2 credentials and endpoint are present."""
    return bool(S3_ACCESS_KEY and S3_SECRET_KEY and S3_ENDPOINT_URL)

def get_s3_client():
    """
    Initializes and returns a thread-safe boto3 S3 client configured for IDrive e2.
    """
    global _s3_client
    if _s3_client is None:
        if not is_s3_configured():
            raise ValueError(
                "IDrive e2 storage credentials (S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY) are not configured."
            )
        _s3_client = boto3.client(
            "s3",
            endpoint_url=S3_ENDPOINT_URL,
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )
    return _s3_client

def save_file_locally(file_bytes: bytes, filename: str) -> str:
    """
    Fallback: Saves photo bytes to local disk in uploads/ directory.
    Returns relative web path (e.g. '/uploads/abc123_photo.jpg').
    """
    unique_prefix = uuid.uuid4().hex[:12]
    clean_filename = filename.replace(" ", "_").replace("/", "_")
    saved_filename = f"{unique_prefix}_{clean_filename}"
    file_path = os.path.join(UPLOADS_DIR, saved_filename)
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    return f"/uploads/{saved_filename}"

def upload_file_to_s3(file: UploadFile, filename: str) -> str:
    """
    Uploads the raw high-res photo to IDrive e2 origin storage.
    Returns the storage object path (e.g., 'photos/unique_filename.jpg').
    """
    s3 = get_s3_client()
    
    unique_prefix = uuid.uuid4().hex[:12]
    clean_filename = filename.replace(" ", "_").replace("/", "_")
    object_path = f"photos/{unique_prefix}_{clean_filename}"

    content_type = file.content_type or "application/octet-stream"

    # Reset file pointer to beginning
    file.file.seek(0)
    
    s3.upload_fileobj(
        file.file,
        S3_BUCKET_NAME,
        object_path,
        ExtraArgs={
            "ContentType": content_type,
            "CacheControl": "max-age=31536000, public"
        }
    )

    return object_path

def generate_cdn_urls(object_path: str) -> Dict[str, str]:
    """
    Generates multi-cloud routing URLs:
    1. high_res_url: Routed through Cloudflare edge CDN for cached raw delivery (or local static url).
    2. thumbnail_url: Routed through ImageKit for on-the-fly WebP compression (or local static url).
    """
    # If already a full URL (e.g. Cloudinary secure URL)
    if object_path.startswith("http://") or object_path.startswith("https://"):
        return {
            "high_res_url": object_path,
            "thumbnail_url": object_path
        }

    # If using local fallback URL (/uploads/...)
    if object_path.startswith("/uploads/"):
        return {
            "high_res_url": object_path,
            "thumbnail_url": object_path
        }

    clean_path = object_path.lstrip("/")
    
    # Cloudflare CDN cached endpoint
    cf_base = CLOUDFLARE_CDN_DOMAIN.rstrip("/")
    high_res_url = f"{cf_base}/{clean_path}"

    # ImageKit WebP optimization with transform
    ik_base = IMAGEKIT_URL_ENDPOINT.rstrip("/")
    thumbnail_url = f"{ik_base}/tr:w-600,f-webp,q-80/{clean_path}"

    return {
        "high_res_url": high_res_url,
        "thumbnail_url": thumbnail_url
    }
