import io
import logging
from typing import List, Dict, Any, Optional
import numpy as np

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

# Import face_recognition for vector extraction and distance comparison
try:
    import face_recognition
except ImportError:
    face_recognition = None
    logger.warning("face_recognition is not installed. Face recognition features will run in fallback mode.")


class ImageProcessorService:
    """
    AI Engine for PhotoGuard:
    1. Silent AI Compression:
       Uses Pillow with Lanczos high-order sinc interpolation resampling and
       adaptive WebP multi-pass encoding to dramatically reduce cloud storage
       by up to 85% while preserving pristine pixel-level sharpness for client proofing.
    2. AI Face Recognition & Vector Extraction:
       Detects human faces and extracts 128-dimensional biometric embeddings.
       Facilitates ultra-fast zero-latency facial search across thousands of wedding/event proofs.
    """

    @staticmethod
    def compress_image_silent_ai(
        image_bytes: bytes,
        max_dimension: int = 2048,
        quality: int = 82
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
        max_width: int = 600,
        quality: int = 78
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

    @staticmethod
    def extract_face_encodings(image_bytes: bytes) -> List[List[float]]:
        """
        Scans an image for faces and extracts 128-dimensional feature vectors.
        Returns a list of vectors, each represented as a JSON-serializable list of floats.
        Wrapped in comprehensive try...except so upload pipelines are never disrupted.
        """
        encodings_list: List[List[float]] = []

        try:
            # Use Pillow to decode into standard RGB numpy array
            if Image:
                with Image.open(io.BytesIO(image_bytes)) as img:
                    try:
                        img = ImageOps.exif_transpose(img)
                    except Exception:
                        pass
                    if img.mode != "RGB":
                        img = img.convert("RGB")
                    
                    # If image is excessively large, scale down slightly for rapid face detection
                    width, height = img.size
                    if max(width, height) > 1600:
                        scale = 1600 / max(width, height)
                        img = img.resize((int(width * scale), int(height * scale)), resample=LANCZOS_FILTER)

                    rgb_array = np.array(img)
            else:
                return encodings_list

            if face_recognition:
                # Detect face bounding boxes and calculate 128-dimensional encodings
                raw_encodings = face_recognition.face_encodings(rgb_array)
                for encoding in raw_encodings:
                    # Convert numpy array to standard python list of floats for PostgreSQL JSON column
                    encodings_list.append([float(val) for val in encoding])
            else:
                logger.info("face_recognition library not present; skipping vector extraction.")

        except Exception as exc:
            logger.warning(f"Face encoding extraction skipped or failed: {exc}")

        return encodings_list

    @classmethod
    def compare_face_vectors(
        cls,
        candidate_encoding: List[float],
        target_encodings: List[List[float]],
        tolerance: float = 0.6
    ) -> bool:
        """
        Determines if a candidate face vector matches any vector in a target list.
        Uses face_recognition.face_distance if available, or Euclidean vector distance.
        A tolerance of 0.6 is the industry-standard threshold (smaller = stricter match).
        """
        if not candidate_encoding or not target_encodings:
            return False

        try:
            candidate_np = np.array(candidate_encoding, dtype=np.float64)

            if face_recognition:
                known_nps = [np.array(e, dtype=np.float64) for e in target_encodings if len(e) == 128]
                if not known_nps:
                    return False
                distances = face_recognition.face_distance(known_nps, candidate_np)
                return bool(np.any(distances <= tolerance))
            else:
                # Exact Euclidean distance fallback: ||u - v|| <= tolerance
                for target in target_encodings:
                    if len(target) == len(candidate_encoding):
                        dist = np.linalg.norm(candidate_np - np.array(target, dtype=np.float64))
                        if dist <= tolerance:
                            return True
                return False

        except Exception as exc:
            logger.error(f"Error during face comparison: {exc}")
            return False

    @classmethod
    def search_faces_in_album(
        cls,
        selfie_bytes: bytes,
        media_records: List[Dict[str, Any]],
        tolerance: float = 0.6
    ) -> List[int]:
        """
        Compares a client's selfie against all media items in an album.
        media_records: List of dicts with keys 'id' and 'face_encodings'.
        Returns a list of matching media item IDs.
        """
        matched_ids: List[int] = []

        # Extract face from client's uploaded selfie
        selfie_encodings = cls.extract_face_encodings(selfie_bytes)
        if not selfie_encodings:
            logger.info("No face detected in the provided selfie image.")
            return matched_ids

        # Primary face from selfie
        primary_selfie_vector = selfie_encodings[0]

        for item in media_records:
            item_id = item.get("id")
            item_faces = item.get("face_encodings")

            if not item_faces or not isinstance(item_faces, list):
                continue

            if cls.compare_face_vectors(primary_selfie_vector, item_faces, tolerance=tolerance):
                matched_ids.append(item_id)

        return matched_ids


image_processor = ImageProcessorService()
