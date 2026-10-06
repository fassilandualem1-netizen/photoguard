import os
import uuid
import logging
from typing import Dict, Optional, Union
import typing
import boto3
from botocore.client import Config
from fastapi import UploadFile
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("photoguard.storage")

# Cloudinary Permanent Cloud Storage Configuration
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")

is_cloudinary_initialized = False

try:
    import cloudinary
    import cloudinary.uploader

    if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
        cloudinary.config(
            cloud_name=str(CLOUDINARY_CLOUD_NAME).strip(),
            api_key=str(CLOUDINARY_API_KEY).strip(),
            api_secret=str(CLOUDINARY_API_SECRET).strip(),
            secure=True
        )
        is_cloudinary_initialized = True
        logger.info("[Storage] Cloudinary permanent storage initialized successfully.")
    else:
        logger.info("[Storage] Cloudinary environment variables missing or incomplete. Using fallback storage.")
except Exception as c_err:
    logger.warning(f"[Storage] Cloudinary initialization safely caught exception: {c_err}")
    is_cloudinary_initialized = False

def is_cloudinary_configured() -> bool:
    """Checks whether valid Cloudinary credentials are provided in environment."""
    return bool(
        is_cloudinary_initialized or (
            os.environ.get("CLOUDINARY_CLOUD_NAME") and
            os.environ.get("CLOUDINARY_API_KEY") and
            os.environ.get("CLOUDINARY_API_SECRET")
        )
    )

def upload_file_to_cloudinary(file_bytes: typing.Union[bytes, str], filename: str, folder: str = "photoguard_vault") -> Dict[str, str]:
    """
    Uploads photo buffer or file path directly to Cloudinary permanent storage.
    Generates high-resolution secure URL and optimized thumbnail delivery URL.
    """
    if not is_cloudinary_configured():
        raise ValueError("Cloudinary credentials are not configured.")

    import cloudinary.uploader

    base_name = os.path.splitext(filename)[0]
    clean_base = "".join(c for c in base_name if c.isalnum() or c in ("-", "_")).strip()[:40]
    unique_public_id = f"{clean_base}_{uuid.uuid4().hex[:10]}"

    upload_result = cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        public_id=unique_public_id,
        resource_type="image",
        type="authenticated",
        overwrite=True
    )

    secure_url = upload_result.get("secure_url")
    public_id = upload_result.get("public_id")

    # Generate responsive WebP thumbnail transformation on-the-fly
    thumbnail_url = secure_url
    if secure_url and "/upload/" in secure_url:
        thumbnail_url = secure_url.replace(
            "/upload/",
            "/upload/f_avif,q_auto:best,dpr_2.0,w_1200,c_limit/"
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

    import cloudinary.uploader

    public_id = public_id_or_url
    if "res.cloudinary.com" in public_id_or_url:
        try:
            parts = public_id_or_url.split("/upload/")[-1].split("/")
            clean_parts = [
                p for p in parts
                if not p.startswith("v") and not (
                    p.startswith("c_") or p.startswith("w_") or p.startswith("q_") or
                    p.startswith("f_") or p.startswith("dpr_") or p.startswith("h_")
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

S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "photoguard-production")

CLOUDFLARE_CDN_DOMAIN = os.environ.get("CLOUDFLARE_CDN_DOMAIN", "https://cdn.photoguard.com")
IMAGEKIT_URL_ENDPOINT = os.environ.get("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/photoguard")

# Local storage fallback directory
UPLOADS_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

_s3_client = None

def is_s3_configured() -> bool:
    """Checks whether valid S3/IDrive e2 credentials and endpoint are present."""
    return bool(
        os.environ.get("S3_ACCESS_KEY") and
        os.environ.get("S3_SECRET_KEY") and
        os.environ.get("S3_ENDPOINT_URL")
    )

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
        try:
            _s3_client = boto3.client(
                "s3",
                endpoint_url=os.environ.get("S3_ENDPOINT_URL"),
                aws_access_key_id=os.environ.get("S3_ACCESS_KEY"),
                aws_secret_access_key=os.environ.get("S3_SECRET_KEY"),
                config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
            )
        except Exception as s3_err:
            logger.error(f"[Storage] Failed to initialize S3 client: {s3_err}")
            raise
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

def save_thumbnail_locally(thumb_bytes: bytes, filename: str) -> str:
    """
    Saves optimized, retina-quality WebP thumbnail to uploads/ directory.
    Delivers lightweight, crystal-clear proof images for web & mobile grids.
    """
    unique_prefix = uuid.uuid4().hex[:12]
    base_name = os.path.splitext(filename)[0].replace(" ", "_").replace("/", "_")[:40]
    saved_filename = f"thumb_{unique_prefix}_{base_name}.webp"
    file_path = os.path.join(UPLOADS_DIR, saved_filename)
    with open(file_path, "wb") as f:
        f.write(thumb_bytes)
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
            "CacheControl": "private, no-store"
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

def generate_cloudinary_signature(folder: str, timestamp: int) -> str:
    """
    Generates a secure SHA-1 signature for client-side direct-to-cloud upload to Cloudinary.
    Signature covers the folder and timestamp parameters.
    """
    import hashlib
    secret = str(CLOUDINARY_API_SECRET or '').strip()
    # Parameters must be sorted alphabetically: folder, timestamp
    to_sign = f"folder={folder}&timestamp={timestamp}{secret}"
    return hashlib.sha1(to_sign.encode('utf-8')).hexdigest()

def destroy_media_asset(url_or_path: str) -> bool:
    """
    Permanently destroys a media file from Cloudinary, S3/IDrive e2, or local disk.
    Airtight destruction for both high-resolution images and thumbnail proofs.
    """
    if not url_or_path:
        return False
    from app.core.s3_cleanup import delete_file_from_s3
    try:
        if "res.cloudinary.com" in url_or_path:
            return delete_file_from_cloudinary(url_or_path)
        elif url_or_path.startswith("/uploads/"):
            clean_filename = os.path.basename(url_or_path)
            local_filepath = os.path.join(UPLOADS_DIR, clean_filename)
            if os.path.exists(local_filepath):
                try:
                    os.remove(local_filepath)
                    logger.info(f"[Storage] Deleted local file: {local_filepath}")
                    return True
                except Exception as del_f_err:
                    logger.warning(f"Could not remove local file {local_filepath}: {del_f_err}")
                    return False
            return True
        else:
            return delete_file_from_s3(url_or_path)
    except Exception as exc:
        logger.warning(f"[Storage] Failed to destroy asset {url_or_path}: {exc}")
        return False

def generate_signed_clean_url(raw_url: str) -> str:
    """
    Generates a cryptographically signed delivery URL with light compression.
    Watermarks have been completely eradicated as the mobile client enforces FLAG_SECURE.
    """
    if not is_cloudinary_configured() or "res.cloudinary.com" not in raw_url:
        return ""
    try:
        import cloudinary.utils
        
        # Dynamically determine the asset type
        asset_type = "authenticated" if "/authenticated/" in raw_url else "upload"
        
        if asset_type == "authenticated":
            parts = raw_url.split("/authenticated/")[-1].split("/")
        else:
            parts = raw_url.split("/upload/")[-1].split("/")
            
        clean_parts = [
            p for p in parts
            if not p.startswith("v") and not (
                p.startswith("c_") or p.startswith("w_") or p.startswith("q_") or p.startswith("s--") or p.startswith("l_") or p.startswith("f_")
            )
        ]
        full_path = "/".join(clean_parts)
        public_id = os.path.splitext(full_path)[0]

        transformation = [
            {"width": 1200, "crop": "limit", "quality": "auto:good", "fetch_format": "auto"}
        ]
        signed_url, _ = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="image",
            type=asset_type,
            transformation=transformation,
            sign_url=True,
            secure=True
        )
        return signed_url
    except Exception as exc:
        logger.warning(f"[Storage] Could not generate signed Cloudinary URL: {exc}")
        return ""
    try:
        import cloudinary.utils
        parts = raw_url.split("/upload/")[-1].split("/")
        clean_parts = [
            p for p in parts
            if not p.startswith("v") and not (
                p.startswith("c_") or p.startswith("w_") or p.startswith("q_") or p.startswith("s--") or p.startswith("l_") or p.startswith("f_")
            )
        ]
        full_path = "/".join(clean_parts)
        public_id = os.path.splitext(full_path)[0]

        transformation = [
            {"width": 1200, "crop": "limit", "quality": "auto:good", "fetch_format": "auto"}
        ]
        signed_url, _ = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="image",
            type="authenticated",
            transformation=transformation,
            sign_url=True,
            secure=True
        )
        return signed_url
    except Exception as exc:
        logger.warning(f"[Storage] Could not generate signed Cloudinary URL: {exc}")
        return ""

def generate_s3_presigned_url(object_key: str, expires_in: int = 300) -> str:
    """Generates a short-lived presigned URL for a private S3 object."""
    s3 = get_s3_client()
    if not s3:
        return ""
    try:
        clean_key = object_key.replace("s3://", "")
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET_NAME, "Key": clean_key},
            ExpiresIn=expires_in,
        )
    except Exception as e:
        logger.warning(f"[S3] Could not generate presigned URL: {e}")
        return ""
