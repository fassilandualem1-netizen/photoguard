import secrets
import string
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

def generate_album_pin(length: int = 6) -> str:
    """
    Generates a secure 6-digit numeric PIN for client album access.
    """
    digits = string.digits
    return "".join(secrets.choice(digits) for _ in range(length))

class Album(Base):
    """
    Album Model for PhotoGuard.
    Represents a client photo session managed by a Photographer.
    Includes is_locked for collaborative Single Submit Lock enforcement,
    and submitted_at for Web Dashboard submission alerts.
    """
    __tablename__ = "albums"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    client_name = Column(String(255), nullable=False)
    pin = Column(String(6), unique=True, index=True, nullable=False, default=generate_album_pin)
    photographer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Collaborative Single Submit Lock:
    # Once any client device hits submit, the album is locked for all collaborators.
    is_locked = Column(Boolean, default=False, nullable=False)
    
    # Timestamp when client locked and submitted their final selections
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Download permissions toggle controlled by the photographer
    allow_download = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    photographer = relationship("User", back_populates="albums")
    media_items = relationship("MediaItem", back_populates="album", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Album(id={self.id}, title='{self.title}', pin='{self.pin}', locked={self.is_locked})>"

class MediaItem(Base):
    """
    MediaItem Model representing individual photos in an Album.
    Tracks original size vs compressed size for the Virtual Quota calculation,
    selection status, and client feedback notes.
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
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    album = relationship("MediaItem", back_populates="media_items") if False else relationship("Album", back_populates="media_items")

    def __repr__(self):
        return f"<MediaItem(id={self.id}, album_id={self.album_id}, filename='{self.filename}', selected={self.is_selected})>"
