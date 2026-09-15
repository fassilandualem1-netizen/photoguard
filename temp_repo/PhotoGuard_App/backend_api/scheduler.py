import time
import logging
import datetime
import threading
import requests
from flask import Flask

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    apscheduler_available = True
except ImportError:
    BackgroundScheduler = None
    apscheduler_available = False

from db import db
from models import Album, MediaItem, ClientSelection, SecurityLog
from storage import storage_manager, MediaCompressor

logger = logging.getLogger(__name__)


def run_post_submission_shrink(app: Flask):
    """
    Phase 1 & 2 Cleanup Trigger (20-Minute Post-Submission Expiration):
    Finds locked albums where submission_grace_expires_at UTC timestamp has passed,
    deletes unselected files from 4-tier cloud storage, and micro-compresses selected files.
    """
    with app.app_context():
        try:
            db.session.rollback()
            now_utc = datetime.datetime.utcnow()

            # Query locked albums that expired their 20-min grace window and haven't been shrunk yet
            pending_albums = Album.query.filter(
                Album.is_locked == True,
                Album.is_shrunk == False,
                Album.submission_grace_expires_at != None,
                Album.submission_grace_expires_at <= now_utc
            ).all()

            if not pending_albums:
                return

            logger.info(f"[Storage Cleanup Scheduler] Found {len(pending_albums)} album(s) pending post-submission auto-purge & shrink.")

            for album in pending_albums:
                try:
                    # Get selected media IDs for this album
                    selections = ClientSelection.query.filter_by(album_id=album.id).all()
                    selected_media_ids = {s.media_item_id for s in selections}

                    media_items = list(album.media_items)
                    unselected_count = 0
                    shrunk_count = 0

                    for item in media_items:
                        if item.id not in selected_media_ids:
                            # 1. DELETE UNSELECTED PHOTO/VIDEO
                            try:
                                storage_manager.delete_file(
                                    file_url=item.file_url,
                                    provider=item.storage_provider,
                                    media_type=item.media_type
                                )
                            except Exception as del_err:
                                logger.warning(f"[Auto-Purge Warning] Failed cloud deletion for item {item.id}: {del_err}")

                            db.session.delete(item)
                            unselected_count += 1
                        else:
                            # 2. MICRO-COMPRESS SELECTED PHOTO TO ~30KB
                            try:
                                # Fetch original image bytes
                                if item.file_url and item.file_url.startswith("http"):
                                    resp = requests.get(item.file_url, timeout=15)
                                    if resp.status_code == 200:
                                        raw_bytes = resp.content
                                        filename = item.file_url.rstrip('/').split('/')[-1]

                                        # Generate ~20-30KB micro-thumbnail WebP archive
                                        micro_bytes, micro_name = MediaCompressor.create_micro_thumbnail(raw_bytes, filename, max_dim=300, quality=40)
                                        
                                        # Upload micro-thumbnail to cloud storage
                                        res = storage_manager.upload_photo(micro_bytes, micro_name)
                                        if res.get('url'):
                                            # Delete old high-res cloud object if filename changed
                                            if res.get('url') != item.file_url:
                                                storage_manager.delete_file(file_url=item.file_url, provider=item.storage_provider, media_type=item.media_type)
                                            
                                            item.file_url = res.get('url')
                                            item.file_size = len(micro_bytes)
                                            item.storage_provider = res.get('provider', item.storage_provider)
                                            shrunk_count += 1
                            except Exception as shrink_err:
                                logger.warning(f"[Auto-Shrink Warning] Micro-compression failed for item {item.id}: {shrink_err}")

                    album.is_shrunk = True
                    log = SecurityLog(album_id=album.id, event_type=f"Auto Post-Submission Purge Completed ({unselected_count} purged, {shrunk_count} shrunk to ~30KB)")
                    db.session.add(log)
                    db.session.commit()
                    logger.info(f"[Storage Cleanup Scheduler] Album #{album.id} ('{album.title}') post-submission shrink finished: {unselected_count} unselected purged, {shrunk_count} selected micro-compressed.")
                except Exception as album_err:
                    db.session.rollback()
                    logger.error(f"[Storage Cleanup Scheduler] Error processing album #{album.id}: {album_err}")

        except Exception as e:
            db.session.rollback()
            logger.error(f"[Storage Cleanup Scheduler] Unexpected error in post-submission shrink job: {e}")


def run_album_expiration_wipe(app: Flask):
    """
    Phase 3 Cleanup Trigger (Total Album Expiration Date):
    Checks for albums where expires_at UTC timestamp has passed, deletes all media files
    from all cloud storage providers, and purges the album record from PostgreSQL.
    """
    with app.app_context():
        try:
            db.session.rollback()
            now_utc = datetime.datetime.utcnow()

            expired_albums = Album.query.filter(
                Album.expires_at != None,
                Album.expires_at <= now_utc
            ).all()

            if not expired_albums:
                return

            logger.info(f"[Storage Cleanup Scheduler] Found {len(expired_albums)} expired album(s) pending total cloud & database wipe.")

            for album in expired_albums:
                try:
                    album_id = album.id
                    album_title = album.title
                    media_items = list(album.media_items)

                    # Delete all remaining media items from cloud storage
                    deleted_count = 0
                    for item in media_items:
                        try:
                            storage_manager.delete_file(
                                file_url=item.file_url,
                                provider=item.storage_provider,
                                media_type=item.media_type
                            )
                            deleted_count += 1
                        except Exception as del_err:
                            logger.warning(f"[Total Wipe Warning] Failed cloud deletion for item {item.id}: {del_err}")

                    # Purge album from database (cascades deletion to media_items, selections, comments)
                    db.session.delete(album)
                    db.session.commit()
                    logger.info(f"[Storage Cleanup Scheduler] Total Wipe Completed for Album #{album_id} ('{album_title}'): {deleted_count} cloud files deleted, database record purged.")
                except Exception as wipe_err:
                    db.session.rollback()
                    logger.error(f"[Storage Cleanup Scheduler] Error wiping expired album #{album.id}: {wipe_err}")

        except Exception as e:
            db.session.rollback()
            logger.error(f"[Storage Cleanup Scheduler] Unexpected error in total album wipe job: {e}")


class StorageCleanupScheduler:
    """
    Automated Storage Cleanup Scheduler Manager:
    Runs background workers every 5 minutes to handle post-submission shrinking and expired album wipes.
    Supports APScheduler with an automatic fallback to daemon threading loop.
    """

    def __init__(self, app: Flask = None):
        self.app = app
        self.scheduler = None
        self.thread = None
        self.is_running = False

    def init_app(self, app: Flask):
        self.app = app
        self.start()

    def start(self):
        if self.is_running:
            return

        self.is_running = True

        if apscheduler_available:
            try:
                self.scheduler = BackgroundScheduler(daemon=True)
                self.scheduler.add_job(
                    func=run_post_submission_shrink,
                    trigger="interval",
                    minutes=5,
                    args=[self.app],
                    id="post_submission_shrink_job",
                    replace_existing=True
                )
                self.scheduler.add_job(
                    func=run_album_expiration_wipe,
                    trigger="interval",
                    minutes=5,
                    args=[self.app],
                    id="album_expiration_wipe_job",
                    replace_existing=True
                )
                self.scheduler.start()
                logger.info("[Storage Cleanup Scheduler] BackgroundScheduler started successfully (5-minute interval).")
                return
            except Exception as sched_err:
                logger.warning(f"[Storage Cleanup Scheduler] APScheduler start warning: {sched_err}. Falling back to threading loop.")

        # Fallback Threading Daemon
        def _loop():
            logger.info("[Storage Cleanup Scheduler] Background threading cleanup loop active (5-minute interval).")
            while self.is_running:
                try:
                    time.sleep(300) # 5 minutes interval
                    run_post_submission_shrink(self.app)
                    run_album_expiration_wipe(self.app)
                except Exception as loop_err:
                    logger.error(f"[Storage Cleanup Scheduler] Thread loop error: {loop_err}")

        self.thread = threading.Thread(target=_loop, daemon=True)
        self.thread.start()

cleanup_scheduler = StorageCleanupScheduler()
