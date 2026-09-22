from datetime import datetime
from sqlalchemy import Column, Integer, String, BigInteger, Boolean, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class PlanConfiguration(Base):
    __tablename__ = "plan_configurations"

    id = Column(Integer, primary_key=True, index=True)
    plan_name = Column(String(50), unique=True, index=True, nullable=False)  # 'basic' or 'studio'
    storage_quota_bytes = Column(BigInteger, nullable=False)
    default_lifespan_days = Column(Integer, default=7, nullable=False)
    max_lifespan_days = Column(Integer, default=30, nullable=False)
    can_enable_downloads = Column(Boolean, default=False, nullable=False)
    can_customize_branding = Column(Boolean, default=False, nullable=False)
    can_extend_lifespan = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
