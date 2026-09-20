import os
from typing import Optional, Tuple
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

def check_pin_rate_limit(client_ip: str, pin: str, max_attempts: int = 5, window_seconds: int = 900) -> Tuple[bool, int]:
    """
    Checks if the client IP or target PIN has exceeded allowed verification attempts.
    Window: 900 seconds (15 minutes).
    Max attempts: 5.
    Returns (is_limited: bool, remaining_ttl: int).
    """
    client = get_redis()
    key_ip = f"ratelimit:pin_verify:ip:{client_ip}"
    key_pin = f"ratelimit:pin_verify:pin:{pin}"
    
    attempts_ip = client.get(key_ip)
    attempts_pin = client.get(key_pin)
    
    count_ip = int(attempts_ip) if attempts_ip else 0
    count_pin = int(attempts_pin) if attempts_pin else 0

    if count_ip >= max_attempts:
        ttl = client.ttl(key_ip)
        return True, max(ttl, 1)

    if count_pin >= max_attempts:
        ttl = client.ttl(key_pin)
        return True, max(ttl, 1)

    return False, 0

def record_failed_pin_attempt(client_ip: str, pin: str, window_seconds: int = 900) -> int:
    """
    Increments the failed verification attempt counter in Redis with an expiration window.
    """
    client = get_redis()
    key_ip = f"ratelimit:pin_verify:ip:{client_ip}"
    key_pin = f"ratelimit:pin_verify:pin:{pin}"

    pipe = client.pipeline()
    pipe.incr(key_ip)
    pipe.ttl(key_ip)
    pipe.incr(key_pin)
    pipe.ttl(key_pin)
    results = pipe.execute()

    attempts_ip, ttl_ip, attempts_pin, ttl_pin = results[0], results[1], results[2], results[3]

    if ttl_ip == -1 or attempts_ip == 1:
        client.expire(key_ip, window_seconds)
    if ttl_pin == -1 or attempts_pin == 1:
        client.expire(key_pin, window_seconds)

    return max(attempts_ip, attempts_pin)

def reset_pin_rate_limit(client_ip: str, pin: str) -> None:
    """
    Resets failed attempts upon successful PIN verification.
    """
    try:
        client = get_redis()
        client.delete(f"ratelimit:pin_verify:ip:{client_ip}")
        client.delete(f"ratelimit:pin_verify:pin:{pin}")
    except Exception:
        pass
