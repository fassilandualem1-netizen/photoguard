import os
import time
import logging
import threading
from typing import Optional, Tuple
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from redis import Redis, RedisError
except ImportError:
    Redis = None  # type: ignore
    class RedisError(Exception):  # type: ignore
        pass

logger = logging.getLogger("photoguard.redis")

# Singleton Redis client & initialization flag
_redis_client: Optional[Redis] = None
_redis_initialized: bool = False
_redis_init_lock = threading.Lock()

# Thread-safe in-memory state fallbacks for when REDIS_URL is absent or unreachable
_mem_lock = threading.Lock()
_memory_album_versions: dict[str, int] = {}
_memory_album_locks: set[str] = set()
_memory_rate_limits: dict[str, dict] = {}


def get_redis() -> Optional[Redis]:
    """
    Returns an active Redis client connected to Upstash Redis if configured and healthy.
    If REDIS_URL is missing or the Redis instance is unreachable, returns None gracefully
    without raising unhandled exceptions or polluting SystemErrorLog.
    """
    global _redis_client, _redis_initialized
    if not _redis_initialized:
        with _redis_init_lock:
            if not _redis_initialized:
                url = os.getenv("REDIS_URL")
                if not url:
                    logger.info("REDIS_URL not configured. Smart Polling & locking operating in high-performance in-memory fallback mode.")
                    _redis_client = None
                    _redis_initialized = True
                    return None

                try:
                    client = Redis.from_url(
                        url,
                        decode_responses=True,
                        socket_timeout=3,
                        socket_connect_timeout=3,
                        retry_on_timeout=False
                    )
                    # Quick connectivity check
                    client.ping()
                    _redis_client = client
                    logger.info("Successfully connected to Redis instance for Smart Polling.")
                except Exception as exc:
                    logger.warning(f"Could not establish connection to Redis ({exc}). Falling back to in-memory store.")
                    _redis_client = None

                _redis_initialized = True

    return _redis_client


def get_album_version(pin: str) -> int:
    """
    Retrieves the current version integer for smart polling live synchronization.
    Falls back to the in-memory store if Redis is unavailable.
    """
    client = get_redis()
    if client is not None:
        try:
            val = client.get(f"album_version:{pin}")
            if val is not None:
                return int(val)
        except RedisError as exc:
            logger.warning(f"Redis get_album_version failed: {exc}. Using in-memory fallback.")

    with _mem_lock:
        return _memory_album_versions.get(pin, 1)


def increment_album_version(pin: str) -> int:
    """
    Increments the version counter for an album to alert smart-polling client devices.
    Falls back to the in-memory store if Redis is unavailable.
    """
    client = get_redis()
    if client is not None:
        try:
            new_version = client.incr(f"album_version:{pin}")
            with _mem_lock:
                _memory_album_versions[pin] = int(new_version)
            return int(new_version)
        except RedisError as exc:
            logger.warning(f"Redis increment_album_version failed: {exc}. Using in-memory fallback.")

    with _mem_lock:
        current_version = _memory_album_versions.get(pin, 1)
        new_version = current_version + 1
        _memory_album_versions[pin] = new_version
        return new_version


def lock_album_submit(pin: str) -> bool:
    """
    Enforces the Atomic Single-Submit Lock using Redis setnx.
    Falls back to thread-safe in-memory lock set if Redis is unavailable.
    Returns True if the lock was acquired, False if already locked.
    """
    client = get_redis()
    if client is not None:
        try:
            acquired = bool(client.setnx(f"album_locked:{pin}", "locked"))
            if acquired:
                with _mem_lock:
                    _memory_album_locks.add(pin)
            return acquired
        except RedisError as exc:
            logger.warning(f"Redis lock_album_submit failed: {exc}. Using in-memory fallback.")

    with _mem_lock:
        if pin in _memory_album_locks:
            return False
        _memory_album_locks.add(pin)
        return True


def is_album_locked(pin: str) -> bool:
    """
    Checks whether the album has been submitted and locked.
    Falls back to thread-safe in-memory lock set if Redis is unavailable.
    """
    client = get_redis()
    if client is not None:
        try:
            return bool(client.exists(f"album_locked:{pin}"))
        except RedisError as exc:
            logger.warning(f"Redis is_album_locked failed: {exc}. Using in-memory fallback.")

    with _mem_lock:
        return pin in _memory_album_locks


def check_pin_rate_limit(client_ip: str, pin: str, max_attempts: int = 5, window_seconds: int = 900) -> Tuple[bool, int]:
    """
    Checks if client IP or target PIN has exceeded allowed verification attempts (5 per 15 min).
    Returns (is_limited: bool, remaining_ttl: int).
    Falls back to thread-safe in-memory sliding window if Redis is unavailable.
    """
    client = get_redis()
    if client is not None:
        try:
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
        except RedisError as exc:
            logger.warning(f"Redis check_pin_rate_limit failed: {exc}. Using in-memory fallback.")

    # In-memory rate limiting fallback
    now = time.time()
    with _mem_lock:
        for key in (f"ip:{client_ip}", f"pin:{pin}"):
            entry = _memory_rate_limits.get(key)
            if entry:
                if now > entry["expires_at"]:
                    _memory_rate_limits.pop(key, None)
                elif entry["count"] >= max_attempts:
                    remaining = max(1, int(entry["expires_at"] - now))
                    return True, remaining

        return False, 0


def record_failed_pin_attempt(client_ip: str, pin: str, window_seconds: int = 900) -> int:
    """
    Increments failed verification attempts with expiration window.
    Falls back to in-memory store if Redis is unavailable.
    """
    client = get_redis()
    if client is not None:
        try:
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
        except RedisError as exc:
            logger.warning(f"Redis record_failed_pin_attempt failed: {exc}. Using in-memory fallback.")

    now = time.time()
    with _mem_lock:
        highest_count = 1
        for key in (f"ip:{client_ip}", f"pin:{pin}"):
            entry = _memory_rate_limits.get(key)
            if not entry or now > entry["expires_at"]:
                _memory_rate_limits[key] = {"count": 1, "expires_at": now + window_seconds}
                count = 1
            else:
                entry["count"] += 1
                count = entry["count"]
            if count > highest_count:
                highest_count = count

        return highest_count


def reset_pin_rate_limit(client_ip: str, pin: str) -> None:
    """
    Resets failed attempts upon successful PIN verification.
    """
    client = get_redis()
    if client is not None:
        try:
            client.delete(f"ratelimit:pin_verify:ip:{client_ip}")
            client.delete(f"ratelimit:pin_verify:pin:{pin}")
        except Exception:
            pass

    with _mem_lock:
        _memory_rate_limits.pop(f"ip:{client_ip}", None)
        _memory_rate_limits.pop(f"pin:{pin}", None)
