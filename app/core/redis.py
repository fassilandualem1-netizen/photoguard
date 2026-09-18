import os
from typing import Optional
from redis import Redis
from dotenv import load_dotenv

load_dotenv()

_redis_client: Optional[Redis] = None

def get_redis() -> Redis:
    """
    Returns an active Redis client instance connected to Upstash Redis.
    """
    global _redis_client
    if _redis_client is None:
        url = os.getenv("REDIS_URL")
        if not url:
            raise ValueError("REDIS_URL environment variable is not configured.")
        _redis_client = Redis.from_url(
            url,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True
        )
    return _redis_client

def get_album_version(pin: str) -> int:
    """
    Retrieves the current version integer for smart polling live synchronization.
    """
    client = get_redis()
    val = client.get(f"album_version:{pin}")
    if val is None:
        return 1
    return int(val)

def increment_album_version(pin: str) -> int:
    """
    Increments a Redis key album_version:{pin} for Smart Polling.
    Informs all collaborating client devices to refresh gallery state.
    """
    client = get_redis()
    key = f"album_version:{pin}"
    new_version = client.incr(key)
    return int(new_version)

def lock_album_submit(pin: str) -> bool:
    """
    Uses Redis setnx on key album_locked:{pin} to enforce the Atomic Single-Submit Lock.
    Returns True if the lock was successfully acquired by this request,
    or False if another family member / client device has already locked it.
    """
    client = get_redis()
    key = f"album_locked:{pin}"
    return bool(client.setnx(key, "locked"))

def is_album_locked(pin: str) -> bool:
    """
    Checks whether the album has been locked in Redis.
    """
    client = get_redis()
    key = f"album_locked:{pin}"
    return bool(client.exists(key))
