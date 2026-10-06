from app.core.database import SessionLocal
from app.models.album import MediaItem

db = SessionLocal()
items = db.query(MediaItem).limit(5).all()
for item in items:
    print(f"ID: {item.id}, URL: {item.url}, Thumb: {item.thumbnail_url}")
