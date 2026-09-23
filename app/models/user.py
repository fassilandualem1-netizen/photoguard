import enum
from typing import Optional
from sqlalchemy import Column, Integer, String, Enum, DateTime, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from app.core.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PHOTOGRAPHER = "photographer"
    OWNER = "owner"
    ASSISTANT = "assistant"

class User(Base):
    """
    Unified User Model for PhotoGuard.
    Stores system credentials, plan monetization, quota tracking,
    role-based access control (Admin, Photographer/Owner, Assistant),
    and studio white-labeling custom branding for Admins and Photographers.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="photographer", nullable=False)
    
    # Hierarchy Column for Studio Assistants:
    # Sub-users / staff link directly to their parent photographer account
    parent_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Legacy column support (retained for backward compatibility with existing databases)
    parent_owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Monetization & Plan tiers: 'basic' or 'studio'
    subscription_plan = Column(String(50), default="basic", nullable=False)
    # Legacy plan column support for existing PostgreSQL databases with 'plan' column
    plan = Column(String(50), default="basic", nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Storage quota tracking in bytes (defaults to 5 GB for basic plan)
    storage_quota_limit = Column(BigInteger, default=5368709120, nullable=False)
    storage_used = Column(BigInteger, default=0, nullable=False)
    
    # Enterprise Auth Flow: Force password change on first login for admin-created accounts
    needs_password_change = Column(Boolean, default=True, nullable=False)
    
    # Session Invalidation: Immediate JWT revocation on password reset, update, or account suspension
    token_version = Column(Integer, default=1, nullable=False)
    
    # Telegram Bot integration for instant submission alerts
    telegram_chat_id = Column(String(50), nullable=True, index=True)
    
    # Studio Tier Custom White-Label Branding
    studio_logo_url = Column(String(1024), nullable=True)
    brand_color = Column(String(50), default="#F59E0B", nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Hierarchical Relationship for Assistants / Staff
    assistants = relationship(
        "User",
        backref=backref("parent", remote_side="User.id"),
        foreign_keys=[parent_id]
    )

    # Relationships
    albums = relationship("Album", back_populates="photographer", cascade="all, delete-orphan")

    @property
    def effective_owner_id(self) -> int:
        """
        Resolves the primary account entity responsible for storage quota and albums.
        If the user is an assistant or has a parent_id, routes to the parent photographer's ID.
        Otherwise, returns self.id.
        """
        if self.role == UserRole.ASSISTANT.value or self.parent_id is not None:
            return self.parent_id if self.parent_id is not None else self.id
        return self.id

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}', parent_id={self.parent_id}, plan='{self.subscription_plan}', needs_password_change={self.needs_password_change})>"
