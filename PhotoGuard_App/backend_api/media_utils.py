import io
import os
import uuid
import logging
from PIL import Image

logger = logging.getLogger(__name__)

def process_single_photo_upload(file_bytes, original_filename, album_id, storage_manager):
    """
    Processes a single raw photo upload from photographer:
    1. Generates High-Res Master File (~1.5MB - 2.5MB):
       - Proportional WebP/JPEG compression with quality 85-88.
       - No watermark.
    2. Generates Clean Preview File (~200KB - 300KB):
       - Resized to max 1920px dimension.
       - Clean, crisp unwatermarked WebP image.
    3. Uploads both via storage_manager and returns dict.
    """
    unique_suffix = uuid.uuid4().hex[:6]
    base_name, _ = os.path.splitext(original_filename or "photo.jpg")
    clean_base = "".join(c for c in base_name if c.isalnum() or c in ('_', '-')) or "photo"
    
    master_filename = f"master_album_{album_id}_{unique_suffix}_{clean_base}.webp"
    preview_filename = f"preview_album_{album_id}_{unique_suffix}_{clean_base}.webp"

    # Detect video file extension
    ext = os.path.splitext(original_filename or "")[1].lower()
    is_video = ext in ('.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v')

    master_img = None
    preview_img = None
    image = None

    if is_video:
        # Video file fallback processing: upload raw video stream to storage
        filename = f"video_album_{album_id}_{unique_suffix}_{clean_base}{ext}"
        res = storage_manager.upload_photo(file_bytes, filename)
        return {
            'master_url': res.get('url'),
            'preview_url': res.get('url'),
            'master_size': len(file_bytes),
            'preview_size': res.get('file_size', len(file_bytes)),
            'original_size': len(file_bytes),
            'media_type': 'video',
            'provider': res.get('provider', 'cloudinary')
        }

    try:
        image = Image.open(io.BytesIO(file_bytes))
        
        # Convert Palette/RGBA to RGB for WebP/JPEG compatibility
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')

        # -------------------------------------------------------------
        # 1. Master File Generation (~1.5MB - 2.5MB)
        # -------------------------------------------------------------
        master_img = image.copy()
        w, h = master_img.size
        max_dim = max(w, h)
        if max_dim > 3840:
            master_img.thumbnail((3840, 3840), Image.Resampling.LANCZOS)
        
        master_buffer = io.BytesIO()
        master_img.save(master_buffer, format='WEBP', quality=85, method=1)
        master_bytes = master_buffer.getvalue()
        master_size = len(master_bytes)

        # -------------------------------------------------------------
        # 2. Clean Preview Generation (~200KB - 300KB, NO Watermark)
        # -------------------------------------------------------------
        preview_img = image.copy()
        preview_img.thumbnail((1920, 1920), Image.Resampling.LANCZOS)

        preview_buffer = io.BytesIO()
        preview_img.save(preview_buffer, format='WEBP', quality=80, method=1)
        preview_bytes = preview_buffer.getvalue()
        preview_size = len(preview_bytes)

        # -------------------------------------------------------------
        # 3. Upload to Storage Manager
        # -------------------------------------------------------------
        res_master = storage_manager.upload_photo(master_bytes, master_filename)
        res_preview = storage_manager.upload_photo(preview_bytes, preview_filename)

        return {
            'master_url': res_master.get('url'),
            'preview_url': res_preview.get('url'),
            'master_size': master_size,
            'preview_size': preview_size,
            'original_size': len(file_bytes),
            'media_type': 'image',
            'provider': res_preview.get('provider', 'cloudinary')
        }

    except Exception as e:
        logger.error(f"Error processing single photo upload {original_filename}: {e}", exc_info=True)
        filename = f"album_{album_id}_{unique_suffix}_{original_filename}"
        res = storage_manager.upload_photo(file_bytes, filename)
        return {
            'master_url': res.get('url'),
            'preview_url': res.get('url'),
            'master_size': len(file_bytes),
            'preview_size': res.get('file_size', len(file_bytes)),
            'original_size': len(file_bytes),
            'media_type': 'video' if is_video else 'image',
            'provider': res.get('provider', 'cloudinary')
        }
    finally:
        import gc
        if master_img:
            try: master_img.close()
            except Exception: pass
        if preview_img:
            try: preview_img.close()
            except Exception: pass
        if image:
            try: image.close()
            except Exception: pass
        gc.collect()
