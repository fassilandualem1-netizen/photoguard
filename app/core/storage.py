import os
import uuid
from typing import Dict
import boto3
from botocore.client import Config
from fastapi import UploadFile
from dotenv import load_dotenv

load_dotenv()

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "photoguard-production")

CLOUDFLARE_CDN_DOMAIN = os.getenv("CLOUDFLARE_CDN_DOMAIN", "https://cdn.photoguard.com")
IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/photoguard")

_s3_client = None

def get_s3_client():
    """
    Initializes and returns a thread-safe boto3 S3 client configured for IDrive e2.
    """
    global _s3_client
    if _s3_client is None:
        if not S3_ACCESS_KEY or not S3_SECRET_KEY or not S3_ENDPOINT_URL:
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
    1. high_res_url: Routed through Cloudflare edge CDN for cached raw delivery.
    2. thumbnail_url: Routed through ImageKit for on-the-fly WebP compression (w=600, q=80).
    """
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
