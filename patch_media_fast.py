import os
import re

filepath = "app/api/media.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# We need to replace the entire `def upload_album_photo` block.
start_str = "def upload_album_photo("
end_str = "# CLD-01 / S3-01: Generate signed URLs"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx == -1 or end_idx == -1:
    print("Could not find block")
    exit(1)

new_function = """def upload_album_photo(
    album_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve album without locking the row for every concurrent upload
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found.")

    # Check Expiration
    now_utc = datetime.now(timezone.utc)
    if album.expires_at:
        album_expires_utc = album.expires_at if album.expires_at.tzinfo else album.expires_at.replace(tzinfo=timezone.utc)
        if album_expires_utc <= now_utc:
            raise HTTPException(status_code=403, detail="Album has expired.")

    # Permission check
    if not check_media_album_access(album, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied.")

    # Cannot upload to an already submitted album
    if album.is_locked:
        raise HTTPException(status_code=403, detail="Album is locked.")

    # Basic File Validation
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Unsupported image format.")
    
    file_bytes = file.file.read()
    original_size = len(file_bytes)
    
    if original_size == 0 or original_size > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Invalid file size.")

    # Virtual Quota Check
    effective_owner_id = current_user.effective_owner_id or current_user.id
    owner = db.query(User).filter(User.id == effective_owner_id).first()
        
    if owner and ((owner.storage_used or 0) + original_size > owner.storage_quota_limit):
        raise HTTPException(status_code=402, detail="Storage quota exceeded for this studio account.")

    # Cloud Upload
    high_res_url = None
    thumbnail_url = None
    object_path = None
    storage_provider = "local"

    if is_cloudinary_configured():
        try:
            cloud_res = upload_file_to_cloudinary(
                file_bytes=file_bytes,
                filename=file.filename or "photo.jpg",
                folder=f"photoguard_vault/{album.pin}"
            )
            high_res_url = cloud_res["high_res_url"]
            thumbnail_url = cloud_res["thumbnail_url"]
            storage_provider = "cloudinary"
        except Exception as cloud_exc:
            logger.warning(f"Cloudinary upload failed: {cloud_exc}")

    if not high_res_url and is_s3_configured():
        try:
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
            
            with open(tmp_path, "rb") as f_s3:
                file.file = f_s3
                object_path = upload_file_to_s3(file=file, filename=file.filename or "photo.jpg")
            
            cdn_urls = generate_cdn_urls(object_path=object_path)
            high_res_url = cdn_urls["high_res_url"]
            thumbnail_url = cdn_urls["thumbnail_url"]
            storage_provider = "s3"
            os.remove(tmp_path)
        except Exception as s3_exc:
            logger.warning(f"S3 upload failed: {s3_exc}")

    if not high_res_url:
        raise HTTPException(status_code=502, detail="Cloud Storage Upload Failed")

    # DB Record
    media_item = MediaItem(
        album_id=album.id,
        filename=file.filename or "photo.jpg",
        url=high_res_url,
        thumbnail_url=thumbnail_url,
        original_size=original_size,
        compressed_size=int(original_size * 0.15),
        is_selected=False,
        client_notes=None,
    )

    try:
        if owner:
            owner.storage_used = (owner.storage_used or 0) + original_size

        db.add(media_item)
        db.commit()
        db.refresh(media_item)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"DB Error: {exc}")
        raise HTTPException(status_code=500, detail="Database save failed.")

    try:
        increment_album_version(album.pin)
    except Exception:
        pass

    """

content = content[:start_idx] + new_function + content[end_idx:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Simplified media upload API successfully!")
