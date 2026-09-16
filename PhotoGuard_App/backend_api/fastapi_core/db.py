import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from .models import Base

# By default use SQLite if no DATABASE_URL is provided (useful for local dev)
# On Render, set DATABASE_URL=postgresql://user:pass@host/dbname
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./photoguard.db")

# Render postgresql strings usually start with postgres://, but SQLAlchemy 1.4+ needs postgresql://
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    branding_columns = {
        "brand_color": "VARCHAR(20)",
        "logo_url": "VARCHAR(255)",
        "custom_welcome_message": "VARCHAR(500)",
    }
    missing = {
        name: definition
        for name, definition in branding_columns.items()
        if name not in columns
    }
    if missing:
        with engine.begin() as connection:
            for name, definition in missing.items():
                connection.execute(text(f"ALTER TABLE users ADD COLUMN {name} {definition}"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
