import os
import logging
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Configure Cloudinary globally using environment variables
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

def upload_image_buffer(file_buffer, public_id=None):
    """
    Uploads a raw byte-buffer directly to Cloudinary CDN.
    Automatically converts to 1080p WebP format for ultra-lightweight streaming.
    """
    try:
        # Enforce Cloudinary transformation for strict WebP 1080p compression
        upload_options = {
            "resource_type": "image",
            "format": "webp",
            "transformation": [
                {"width": 1920, "height": 1080, "crop": "limit", "quality": "auto"}
            ]
        }
        
        if public_id:
            upload_options["public_id"] = public_id

        logger.info("Uploading image buffer to Cloudinary CDN...")
        # file_buffer is passed directly, allowing in-memory upload without touching disk
        result = cloudinary.uploader.upload(file_buffer, **upload_options)
        
        secure_url = result.get('secure_url')
        logger.info(f"Upload successful. Secure URL: {secure_url}")
        
        return secure_url
        
    except Exception as e:
        logger.error(f"CRITICAL: Cloudinary buffer upload failed: {e}")
        # Re-raise to ensure the route handler aborts gracefully
        raise e
