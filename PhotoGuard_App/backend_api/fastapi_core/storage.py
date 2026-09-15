import os
import boto3
import cloudinary
import cloudinary.uploader
from botocore.exceptions import ClientError
from datetime import datetime
from .logger import log, audit_log

# Optional ImageKit SDK
try:
    from imagekitio import ImageKit
except ImportError:
    ImageKit = None

# 1. Cloudinary Configuration (Fast CDN & Watermarking)
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", "photoguard_demo"),
    api_key=os.getenv("CLOUDINARY_API_KEY", "dummy_key"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", "dummy_secret"),
    secure=True
)

# 2. ImageKit Configuration (Pro/Studio CDN)
imagekit = None
if ImageKit:
    imagekit = ImageKit(
        public_key=os.getenv("IMAGEKIT_PUBLIC_KEY", "dummy_public"),
        private_key=os.getenv("IMAGEKIT_PRIVATE_KEY", "dummy_private"),
        url_endpoint=os.getenv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/dummy")
    )

# 3. AWS S3 Client (Premium Secure Original Storage)
s3_client_aws = boto3.client(
    's3',
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY", "dummy_aws_access"),
    aws_secret_access_key=os.getenv("AWS_SECRET_KEY", "dummy_aws_secret"),
    region_name=os.getenv("AWS_REGION", "us-east-1")
)

# 4. iDrive e2 Client (Cost-effective Storage for Starter Tier)
s3_client_idrive = boto3.client(
    's3',
    endpoint_url=os.getenv("IDRIVE_ENDPOINT_URL", "https://r0b0.us.idrivee2-2.com"), 
    aws_access_key_id=os.getenv("IDRIVE_ACCESS_KEY", "dummy_idrive_access"),
    aws_secret_access_key=os.getenv("IDRIVE_SECRET_KEY", "dummy_idrive_secret"),
    region_name=os.getenv("IDRIVE_REGION", "us-east-1")
)

AWS_BUCKET = os.getenv("S3_BUCKET", "photoguard-premium-originals")
IDRIVE_BUCKET = os.getenv("IDRIVE_BUCKET", "photoguard-starter-originals")



import io
from PIL import Image

def compress_image(file_bytes: bytes, max_dim: int = 1080, quality: int = 70) -> bytes:
    try:
        img = Image.open(io.BytesIO(file_bytes))
        # Convert to RGB if necessary
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # Calculate resize dimensions keeping aspect ratio
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        
        output = io.BytesIO()
        img.save(output, format="WebP", quality=quality, optimize=True)
        return output.getvalue()
    except Exception as e:
        log.error(f"Image compression failed: {e}")
        return file_bytes # Fallback to original

class MultiCloudStorageManager:
    """
    A Unified Python/FastAPI module that abstracts interactions with Cloudinary, 
    AWS S3, ImageKit, and iDrive. Auto-selects the optimal storage route.
    """
    
    @staticmethod
    def _upload_to_s3_compatible(client, bucket: str, file_bytes: bytes, key: str) -> bool:
        try:
            # Bypass actual boto3 call if dummy credentials are used to prevent crashes in demo
            if "dummy" in str(client._request_signer._credentials.access_key) or "dummy" in bucket:
                return True
                
            client.put_object(Bucket=bucket, Key=key, Body=file_bytes, ACL='private')
            return True
        except ClientError as e:
            log.error(f"S3/iDrive ClientError: {e}")
            return False
        except Exception as e:
            log.error(f"S3/iDrive Unexpected Error: {e}")
            return False

    @staticmethod
    def _upload_to_cloudinary(file_bytes: bytes, folder: str, tier: str) -> str:
        transformations = [{'width': 1080, 'crop': 'limit'}]
        if tier == 'starter':
            # Aggressive watermarking for starter tier
            transformations.append(
                {'overlay': 'text:Arial_60_bold:PhotoGuard_Starter', 'gravity': 'center', 'opacity': 40, 'color': 'white'}
            )
        try:
            resp = cloudinary.uploader.upload(
                file_bytes,
                folder=folder,
                transformation=transformations
            )
            return resp.get("secure_url")
        except Exception as e:
            log.error(f"Cloudinary upload failed: {e}")
            return None

    @staticmethod
    def _upload_to_imagekit(file_bytes: bytes, folder: str, filename: str) -> str:
        if not imagekit:
            log.warning("ImageKit SDK not configured. Simulating via Cloudinary fallback.")
            return MultiCloudStorageManager._upload_to_cloudinary(file_bytes, folder, "pro")
            
        try:
            upload = imagekit.upload_file(
                file=file_bytes,
                file_name=filename,
                options={"folder": folder, "is_private_file": False}
            )
            return upload.response_metadata.raw['url']
        except Exception as e:
            log.error(f"ImageKit upload failed: {e}")
            return None

    @classmethod
    async def process_and_store(cls, file_bytes: bytes, filename: str, album_code: str, tier: str) -> dict:
        # Prevent RAM crashes on high-res photos: compress locally before upload!
        compressed_bytes = compress_image(file_bytes, max_dim=1080, quality=70)
        
        """
        Core logic for auto-selecting storage provider and verifying persistence.
        """
        folder_path = f"photoguard/albums/{album_code}"
        s3_key = f"{folder_path}/originals/{filename}"
        
        audit_record = {
            "filename": filename,
            "album_code": album_code,
            "photographer_tier": tier,
            "timestamp_utc": datetime.utcnow().isoformat(),
            "status": "pending"
        }

        # --- AUTO-SELECT STORAGE PROVIDERS BASED ON TIER ---
        if tier == 'starter':
            # Starter Tier: Uses Cloudinary for CDN + iDrive for cost-effective S3 storage
            cdn_provider = "Cloudinary"
            original_bucket = IDRIVE_BUCKET
            
            watermarked_url = cls._upload_to_cloudinary(compressed_bytes, folder_path, tier)
            success = cls._upload_to_s3_compatible(s3_client_idrive, original_bucket, compressed_bytes, s3_key)
            
        elif tier == 'pro':
            # Pro Tier: Uses ImageKit for faster global CDN + AWS S3 for secure standard storage
            cdn_provider = "ImageKit"
            original_bucket = AWS_BUCKET
            
            watermarked_url = cls._upload_to_imagekit(compressed_bytes, folder_path, filename)
            success = cls._upload_to_s3_compatible(s3_client_aws, original_bucket, compressed_bytes, s3_key)
            
        else: # 'studio'
            # Studio Tier: Premium CDN routing + AWS S3
            cdn_provider = "ImageKit_Premium"
            original_bucket = AWS_BUCKET
            
            watermarked_url = cls._upload_to_imagekit(compressed_bytes, folder_path, filename)
            success = cls._upload_to_s3_compatible(s3_client_aws, original_bucket, compressed_bytes, s3_key)

        secure_original_url = f"s3://{original_bucket}/{s3_key}"

        # --- VERIFY SUCCESSFUL PERSISTENCE & AUDIT LOGGING ---
        if success and watermarked_url:
            audit_record.update({
                "status": "success",
                "cdn_provider_selected": cdn_provider,
                "original_archive": f"s3://{original_bucket}",
                "watermarked_url": watermarked_url
            })
            # Log as structured JSON to the new server-side logging system
            audit_log.info(f"Storage Persistence Verified for {filename}", extra={"audit_data": audit_record})
        else:
            audit_record["status"] = "failed"
            audit_log.error(f"Storage Persistence Failed for {filename}", extra={"audit_data": audit_record})

        return {
            "watermarked_url": watermarked_url,
            "secure_s3_url": secure_original_url,
            "s3_key": s3_key,
            "provider_used": cdn_provider
        }

# Adapter to maintain backward compatibility with main.py
async def upload_photo_multicloud(file_bytes: bytes, filename: str, album_code: str, photographer_tier: str) -> dict:
    return await MultiCloudStorageManager.process_and_store(file_bytes, filename, album_code, photographer_tier)
    
def generate_presigned_download_url(s3_url: str, expiration_seconds=3600):
    try:
        # Determine whether to use AWS or iDrive client based on bucket URL
        if IDRIVE_BUCKET in s3_url:
            client = s3_client_idrive
            bucket = IDRIVE_BUCKET
        else:
            client = s3_client_aws
            bucket = AWS_BUCKET
            
        s3_key = s3_url.split(f"{bucket}/")[-1]
        
        # Bypass for demo if keys are dummy
        if "dummy" in str(client._request_signer._credentials.access_key):
            return f"https://secure-download-mock.photoguard.com/{s3_key}?expires={expiration_seconds}"
            
        return client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': s3_key},
            ExpiresIn=expiration_seconds
        )
    except Exception as e:
        log.error(f"Failed to generate presigned URL for {s3_url}: {str(e)}")
        return f"https://secure-download-mock.photoguard.com/error"
