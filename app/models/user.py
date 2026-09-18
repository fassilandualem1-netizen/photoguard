import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, Boolean, BigInteger
from sqlalchemy.sql import func
from app.core.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PHOTOGRAPHER = "photographer"

class User(Base):
    """
    Unified User Model for PhotoGuard.
    Stores system credentials and quota tracking for Admins and Photographers.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role_enum"), default=UserRole.PHOTOGRAPHER, nullable=False)
    
    # Storage quota tracking in bytes (defaults to 5 GB)
    storage_quota_limit = Column(BigInteger, default=5368709120, nullable=False)
    storage_used = Column(BigInteger, default=0, nullable=False)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
