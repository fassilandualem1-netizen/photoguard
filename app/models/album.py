import secrets
import string
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.media import MediaItem

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
    title = Column(String(255), nullable=False, default="Untitled Album")
    client_name = Column(String(255), nullable=True, default="Valued Client")
    pin = Column(String(6), unique=True, index=True, nullable=False, default=generate_album_pin)
    photographer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Collaborative Single Submit Lock:
    # Once any client device hits submit, the album is locked for all collaborators.
    is_locked = Column(Boolean, default=False, nullable=False)
    
    # Timestamp when client locked and submitted their final selections
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Download permissions toggle controlled by the photographer
    allow_download = Column(Boolean, default=False, nullable=False)
    
    # Client Analytics & Tracking:
    view_count = Column(Integer, default=0, nullable=False)
    last_viewed_at = Column(DateTime(timezone=True), nullable=True)
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    photographer = relationship("User", back_populates="albums")
    media_items = relationship("MediaItem", back_populates="album", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Album(id={self.id}, title='{self.title}', pin='{self.pin}', locked={self.is_locked})>"
