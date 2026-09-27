import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Import Pillow for Silent AI Compression
try:
    from PIL import Image, ImageOps
    # Support both Pillow >= 9.1 (Resampling.LANCZOS) and legacy
    LANCZOS_FILTER = getattr(Image.Resampling, "LANCZOS", getattr(Image, "LANCZOS", Image.BICUBIC))
except ImportError:
    Image = None
    ImageOps = None
    LANCZOS_FILTER = None
    logger.warning("Pillow is not installed. AI image compression will be in fallback mode.")


class ImageProcessorService:
    """
    Ultra-lightweight Image Engine for PhotoGuard:
    Silent AI Compression:
    Uses Pillow with Lanczos high-order sinc interpolation resampling and
    adaptive WebP multi-pass encoding to preserve pixel-level sharpness for client proofing.
    """

    @staticmethod
    def compress_image_silent_ai(
        image_bytes: bytes,
        max_dimension: int = 3840,
        quality: int = 90
    ) -> bytes:
        """
        Compresses original RAW/JPEG image bytes using Lanczos filter downsampling and WebP encoding.
        Corrects EXIF orientation, strips bulky camera metadata, and retains optimal visual fidelity.
        """
        if not Image:
            return image_bytes

        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                # Normalize EXIF orientation (portrait vs landscape rotation)
                try:
                    img = ImageOps.exif_transpose(img)
                except Exception:
                    pass

                # Convert palette/RGBA modes to RGB for pristine WebP/JPEG encoding
                if img.mode in ("RGBA", "LA"):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])
                    img = background
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                # Lanczos high-order resampling if dimensions exceed threshold
                width, height = img.size
                if max(width, height) > max_dimension:
                    if width >= height:
                        new_width = max_dimension
                        new_height = max(1, int(height * (max_dimension / width)))
                    else:
                        new_height = max_dimension
                        new_width = max(1, int(width * (max_dimension / height)))
                    
                    img = img.resize((new_width, new_height), resample=LANCZOS_FILTER)

                output_buffer = io.BytesIO()
                # Encode as WebP with high-efficiency multi-pass compression (method=6)
                img.save(
                    output_buffer,
                    format="WEBP",
                    quality=quality,
                    method=6
                )
                return output_buffer.getvalue()

        except Exception as exc:
            logger.error(f"Silent AI compression encountered an error: {exc}. Returning original bytes.")
            return image_bytes

    @staticmethod
    def create_thumbnail_silent_ai(
        image_bytes: bytes,
        max_width: int = 1200,
        quality: int = 86
    ) -> bytes:
        """
        Generates a lightweight, lightning-fast thumbnail WebP for Masonry grid rendering.
        """
        if not Image:
            return image_bytes

        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                try:
                    img = ImageOps.exif_transpose(img)
                except Exception:
                    pass

                if img.mode != "RGB":
                    img = img.convert("RGB")

                width, height = img.size
                if width > max_width:
                    new_width = max_width
                    new_height = max(1, int(height * (max_width / width)))
                    img = img.resize((new_width, new_height), resample=LANCZOS_FILTER)

                output_buffer = io.BytesIO()
                img.save(output_buffer, format="WEBP", quality=quality, method=6)
                return output_buffer.getvalue()

        except Exception as exc:
            logger.error(f"Thumbnail generation error: {exc}. Returning original bytes.")
            return image_bytes


image_processor = ImageProcessorService()
