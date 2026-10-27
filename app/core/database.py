import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("photoguard.database")

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

# Fallback safely to SQLite if DATABASE_URL is not set to prevent startup crash
if not DATABASE_URL:
    logger.warning("[Database] DATABASE_URL not set in environment. Falling back to local SQLite database.")
    DATABASE_URL = "sqlite:///./photoguard.db"

# Fix legacy 'postgres://' URI scheme for SQLAlchemy 1.4+ / 2.0+
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        connect_args=connect_args
    )
else:
    # Enforce SSL and keepalives for cloud PostgreSQL (Supabase / Render)
    if " localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL:
        connect_args = {
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        }
        if "sslmode" not in DATABASE_URL:
            connect_args["sslmode"] = "require"

    # Tuned specifically for Supabase Session Pooler (avoids 'Max client connections reached')
    engine = create_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_timeout=20,
        connect_args=connect_args
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """
    Dependency generator providing a transactional database session per request.
    Rolls back uncommitted state on error and closes the session cleanly.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
