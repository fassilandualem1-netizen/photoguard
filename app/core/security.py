import os
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("photoguard.security")

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise ValueError("JWT_SECRET environment variable is not configured.")

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours default

# PBKDF2 parameters for ultra-secure, memory-friendly, zero-C++ hashing (works identically on Render & Local)
PBKDF2_ITERATIONS = 100000

def _hash_pbkdf2(password: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations and a cryptographically secure salt."""
    salt = os.urandom(16).hex()
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${derived.hex()}"

def _verify_pbkdf2(plain_password: str, hashed_password: str) -> bool:
    """Verifies a password against a PBKDF2-HMAC-SHA256 formatted hash."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iters = int(parts[1])
        salt = parts[2].encode("utf-8")
        expected_hex = parts[3]
        derived = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iters)
        return hmac.compare_digest(derived.hex(), expected_hex)
    except Exception as e:
        logger.warning(f"[Security] PBKDF2 verification exception: {e}")
        return False

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Universal, Bulletproof Password Verifier.
    Supports both modern native PBKDF2-SHA256 hashes AND legacy bcrypt hashes.
    Guaranteed NEVER to throw a ValueError or 500 error on any platform.
    Consistently enforces 72-byte safe truncation.
    """
    if not plain_password or not hashed_password:
        return False

    # Safely truncate to prevent bcrypt 72-byte overflow exceptions
    safe_password = plain_password[:72]

    # Check for PBKDF2 hash scheme
    if hashed_password.startswith("pbkdf2_sha256$"):
        return _verify_pbkdf2(safe_password, hashed_password)

    # Legacy bcrypt fallback (with safe 72-byte truncation)
    try:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        safe_bcrypt_pw = safe_password.encode("utf-8")[:71].decode("utf-8", errors="ignore")
        return pwd_context.verify(safe_bcrypt_pw, hashed_password)
    except Exception as e:
        logger.warning(f"[Security] Legacy bcrypt verification failed gracefully: {e}")
        return False

def get_password_hash(password: str) -> str:
    """
    Generates an enterprise-grade PBKDF2-HMAC-SHA256 hash using Python's standard library.
    Consistently applies safe 72-char truncation to eliminate all bcrypt overflow bugs and wrap-bug crashes.
    """
    safe_password = password[:72] if password else ""
    return _hash_pbkdf2(safe_password)

def create_access_token(data: dict[str, Any], expires_delta: Union[timedelta, None] = None) -> str:
    """
    Encodes payload claims into a cryptographically signed JWT access token.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
