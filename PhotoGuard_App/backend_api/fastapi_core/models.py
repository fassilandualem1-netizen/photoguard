from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float
from sqlalchemy.orm import declarative_base, relationship
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    
    # Telegram Authentication Data
    telegram_id = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=True)
    first_name = Column(String)
    username = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    
    # Role-Based Access Control
    role = Column(String, default="photographer") # 'admin', 'photographer'
    
    # Tiered Subscription Logic
    tier = Column(String, default="starter") # 'starter', 'pro', 'studio'
    
    albums = relationship("Album", back_populates="photographer")
    payments = relationship("PaymentReceipt", back_populates="user")

class Album(Base):
    __tablename__ = 'albums'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    code = Column(String, unique=True, index=True) # 6-digit access code for clients
    expires_at = Column(DateTime, default=datetime.datetime.utcnow)
    photographer_id = Column(Integer, ForeignKey('users.id'))
    
    photographer = relationship("User", back_populates="albums")
    photos = relationship("Photo", back_populates="album", cascade="all, delete")
    submissions = relationship("ClientSubmission", back_populates="album", cascade="all, delete")

class Photo(Base):
    __tablename__ = 'photos'
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    
    # 1. Cloudinary / ImageKit URL (Watermarked, Low-Res, Publicly accessible via CDN for Gallery)
    watermarked_url = Column(String) 
    
    # 2. AWS S3 / iDrive e2 URL (Original, High-Res, Strictly Private Bucket)
    secure_s3_url = Column(String) 
    
    is_selected = Column(Boolean, default=False)
    album_id = Column(Integer, ForeignKey('albums.id'))
    
    album = relationship("Album", back_populates="photos")

class ClientSubmission(Base):
    """Tracks when a client finishes selecting photos for an album."""
    __tablename__ = 'client_submissions'
    id = Column(Integer, primary_key=True, index=True)
    album_id = Column(Integer, ForeignKey('albums.id'))
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    client_notes = Column(String, nullable=True)
    
    album = relationship("Album", back_populates="submissions")

class PaymentReceipt(Base):
    """Tracks manual bank transfers (Telebirr/CBE) waiting for Admin Approval."""
    __tablename__ = 'payment_receipts'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    target_plan = Column(String) # 'pro', 'studio'
    payment_method = Column(String) # 'telebirr', 'cbe'
    transaction_id = Column(String)
    amount_paid = Column(Float, default=0.0)
    status = Column(String, default='PENDING') # 'PENDING', 'APPROVED', 'REJECTED'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="payments")
