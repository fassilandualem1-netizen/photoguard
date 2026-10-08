import os
import time
import shutil
import subprocess
import logging
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("db_backup")

def backup_database():
    """
    Creates a backup of the configured database.
    Supports both local SQLite and remote PostgreSQL databases.
    """
    db_url = os.environ.get("DATABASE_URL", "sqlite:///./photoguard.db")
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    backup_dir = os.path.join(os.path.dirname(__file__), "..", "backups")
    backup_path = None
    
    # Ensure backup directory exists
    os.makedirs(backup_dir, exist_ok=True)
    
    if "sqlite" in db_url:
        # SQLite Backup (Local)
        db_path = db_url.replace("sqlite:///", "")
        
        # Resolve absolute path for db if it's relative
        if db_path.startswith("./"):
            db_path = os.path.join(os.path.dirname(__file__), "..", db_path[2:])
            
        if os.path.exists(db_path):
            backup_path = os.path.join(backup_dir, f"photoguard_backup_{timestamp}.sqlite")
            try:
                shutil.copy2(db_path, backup_path)
                logger.info(f"SQLite database backup created successfully: {backup_path}")
            except Exception as e:
                logger.error(f"Failed to copy SQLite database: {e}")
                backup_path = None
        else:
            logger.error(f"SQLite database file not found at {db_path}")
            
    elif "postgres" in db_url:
        # PostgreSQL Backup (Live/Render/AWS)
        backup_path = os.path.join(backup_dir, f"photoguard_backup_{timestamp}.sql")
        
        logger.info(f"Starting PostgreSQL backup to {backup_path}...")
        
        try:
            # Using pg_dump to extract the database. 
            subprocess.run(
                ["pg_dump", db_url, "-F", "c", "-f", backup_path],
                check=True,
                env=os.environ.copy()
            )
            logger.info(f"PostgreSQL backup created successfully: {backup_path}")
        except FileNotFoundError:
            logger.error("'pg_dump' command not found. Please ensure PostgreSQL client tools are installed.")
            backup_path = None
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create PostgreSQL backup: {e}")
            backup_path = None
        except Exception as e:
            logger.error(f"Unexpected error during backup: {e}")
            backup_path = None
    else:
        logger.warning(f"Unsupported database format for automated backup: {db_url}")

    # Cloudinary Upload (Persistent Backup for Render)
    if backup_path and os.path.exists(backup_path):
        if os.environ.get("CLOUDINARY_URL") or (os.environ.get("CLOUDINARY_API_KEY") and os.environ.get("CLOUDINARY_API_SECRET")):
            logger.info("Uploading backup to Cloudinary for permanent storage...")
            try:
                # Cloudinary is configured via environment variables automatically
                response = cloudinary.uploader.upload(
                    backup_path, 
                    resource_type="raw",
                    folder="photoguard_db_backups"
                )
                logger.info(f"Backup successfully uploaded to Cloudinary: {response.get('secure_url')}")
                
                # Clean up local file since it's uploaded and Render file system is ephemeral anyway
                os.remove(backup_path)
            except Exception as e:
                logger.error(f"Failed to upload backup to Cloudinary: {e}")
        else:
            logger.warning("Cloudinary credentials not found. Backup is saved locally but might be lost on server restart.")


if __name__ == "__main__":
    logger.info("Starting PhotoGuard Automated Database Backup Process...")
    backup_database()
    logger.info("Backup process completed.")
