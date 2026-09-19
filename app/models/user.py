import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, Boolean, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PHOTOGRAPHER = "photographer"

class User(Base):
    """
    Unified User Model for PhotoGuard.
    Stores system credentials, plan monetization, and quota tracking for Admins and Photographers.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role_enum"), default=UserRole.PHOTOGRAPHER, nullable=False)
    
    # Monetization & Plan tiers: 'basic' or 'studio'
    subscription_plan = Column(String(50), default="basic", nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Storage quota tracking in bytes (defaults to 5 GB for basic plan)
    storage_quota_limit = Column(BigInteger, default=5368709120, nullable=False)
    storage_used = Column(BigInteger, default=0, nullable=False)
    
    # Enterprise Auth Flow: Force password change on first login for admin-created accounts
    needs_password_change = Column(Boolean, default=True, nullable=False)
    
    # Telegram Bot integration for instant submission alerts
    telegram_chat_id = Column(String(50), nullable=True, index=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    albums = relationship("Album", back_populates="photographer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}', plan='{self.subscription_plan}', needs_password_change={self.needs_password_change})>"
