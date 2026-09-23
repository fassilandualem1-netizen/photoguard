from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class SystemErrorLog(Base):
    """
    Centralized System & SRE Error Log Model for PhotoGuard.
    Tracks database disconnections, unhandled runtime crashes, network timeouts,
    and client-side sync faults across the React Admin portal, FastAPI backend,
    and Kotlin Jetpack Compose mobile client.
    """
    __tablename__ = "system_error_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    error_type = Column(String(50), nullable=False, index=True)  # e.g., 'DATABASE', 'RUNTIME', 'NETWORK'
    endpoint = Column(String(255), nullable=True, index=True)
    error_message = Column(String(1000), nullable=False)
    traceback_details = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False, server_default="false", nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<SystemErrorLog id={self.id} type='{self.error_type}' endpoint='{self.endpoint}' resolved={self.is_resolved}>"
