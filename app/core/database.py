import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("photoguard.database")

DATABASE_URL = os.environ.get("DATABASE_URL")

# Fallback safely to SQLite if DATABASE_URL is not set to prevent startup crash
if not DATABASE_URL:
    logger.warning("[Database] DATABASE_URL not set in environment. Falling back to local SQLite database.")
    DATABASE_URL = "sqlite:///./photoguard.db"

# Render Fix: Render provides PostgreSQL connection string starting with 'postgres://'
# SQLAlchemy 1.4+ and 2.0 require 'postgresql://' dialect specifier
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Configure engine safely based on database dialect
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        connect_args=connect_args
    )
else:
    # Only enforce sslmode if not connecting to local development server
    if "sslmode" not in DATABASE_URL and "localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL:
        connect_args = {"sslmode": "require"}
    
    # SRE Database Auto-Recovery & Connection Pool Configuration:
    # - pool_pre_ping: emits a lightweight test SELECT 1 before checking out a connection
    #   to automatically purge dead/stale sockets caused by Render/cloud network timeouts.
    # - pool_recycle: recycles pooled connections every 1800s (30m) before cloud firewalls drop them.
    # - pool_size & max_overflow: balances peak concurrency while preventing PostgreSQL max connection limits.
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_timeout=30,
        connect_args=connect_args
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """
    Dependency generator providing a transactional database session per request.
    Closes the session cleanly upon request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
