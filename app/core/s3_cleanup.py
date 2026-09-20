import os
from urllib.parse import urlparse
import boto3
from botocore.exceptions import ClientError
from app.core.storage import get_s3_client, S3_BUCKET_NAME

def extract_s3_object_key(url_or_path: str) -> str:
    """
    Extracts the S3 object key (e.g., 'photos/xyz_filename.jpg') from a full CDN URL or relative path.
    """
    if not url_or_path:
        return ""
    if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
        parsed = urlparse(url_or_path)
        path = parsed.path.lstrip("/")
        # If routed through ImageKit transform paths like tr:w-600,f-webp,q-80/photos/...
        if "photos/" in path:
            idx = path.find("photos/")
            return path[idx:]
        return path
    return url_or_path.lstrip("/")

def delete_file_from_s3(object_path_or_url: str) -> bool:
    """
    Deletes the physical file from the IDrive e2 S3 bucket using boto3.
    Prevents ghost storage charges.
    """
    key = extract_s3_object_key(object_path_or_url)
    if not key:
        return False

    try:
        s3 = get_s3_client()
        s3.delete_object(
            Bucket=S3_BUCKET_NAME,
            Key=key
        )
        return True
    except ClientError as exc:
        print(f"Failed to delete object from S3: {exc}")
        return False
    except Exception as exc:
        print(f"Unexpected error deleting object from S3: {exc}")
        return False
