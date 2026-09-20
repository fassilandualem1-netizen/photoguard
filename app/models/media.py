from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class MediaItem(Base):
    """
    MediaItem Model representing individual photos in an Album.
    Tracks original size vs compressed size for Virtual Quota calculation,
    selection status, client feedback notes, and AI face recognition encodings.
    """
    __tablename__ = "media_items"

    id = Column(Integer, primary_key=True, index=True)
    album_id = Column(Integer, ForeignKey("albums.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    url = Column(String(1024), nullable=False)
    thumbnail_url = Column(String(1024), nullable=True)
    
    # Virtual Quota tracking:
    # original_size: displayed to user (e.g. 40MB RAW/JPEG)
    # compressed_size: actual cloud storage used (e.g. 1.2MB WebP)
    original_size = Column(BigInteger, default=0, nullable=False)
    compressed_size = Column(BigInteger, default=0, nullable=False)
    
    # Selection and review
    is_selected = Column(Boolean, default=False, nullable=False)
    client_notes = Column(String(1000), nullable=True)
    
    # AI Face Recognition: Stores extracted face encodings for instant face search (JSON array of float vectors)
    face_encodings = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    album = relationship("Album", back_populates="media_items")

    def __repr__(self):
        return f"<MediaItem(id={self.id}, album_id={self.album_id}, filename='{self.filename}', selected={self.is_selected})>"
