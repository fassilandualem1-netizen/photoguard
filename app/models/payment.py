from datetime import datetime, timezone
import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from app.core.database import Base

class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class PaymentReceipt(Base):
    __tablename__ = "payment_receipts"

    id = Column(Integer, primary_key=True, index=True)
    photographer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    transaction_ref = Column(String(100), unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50), default="telebirr")  # telebirr or cbe
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    photographer = relationship(
        "User", 
        backref=backref("payment_receipts", passive_deletes=True),
        foreign_keys=[photographer_id],
        passive_deletes=True
    )
