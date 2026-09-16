import logging
import os
import secrets
import threading
import time
from typing import Optional

import redis

logger = logging.getLogger(__name__)
TOKEN_TTL_SECONDS = 30
_KEY_PREFIX = "photoguard:stream-token:"


class SingleUseStreamTokenStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._memory: dict[str, tuple[int, float]] = {}
        self._redis: Optional[redis.Redis] = None

        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                client = redis.Redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
                client.ping()
                self._redis = client
                logger.info("Redis-backed single-use stream tokens enabled")
            except redis.RedisError as exc:
                logger.warning(
                    "Redis is unavailable; using an in-memory stream-token store: %s",
                    exc,
                )
        else:
            logger.warning(
                "REDIS_URL is not configured; using an in-memory stream-token store"
            )

    def issue(self, photo_id: int) -> str:
        token = secrets.token_urlsafe(32)
        if self._redis is not None:
            try:
                self._redis.setex(
                    f"{_KEY_PREFIX}{token}", TOKEN_TTL_SECONDS, str(photo_id)
                )
                return token
            except redis.RedisError as exc:
                logger.warning("Redis token issue failed; using memory fallback: %s", exc)

        with self._lock:
            self._purge_expired_locked()
            self._memory[token] = (photo_id, time.monotonic() + TOKEN_TTL_SECONDS)
        return token

    def consume(self, token: str) -> Optional[int]:
        if self._redis is not None:
            try:
                value = self._redis.getdel(f"{_KEY_PREFIX}{token}")
                return int(value) if value is not None else None
            except redis.RedisError as exc:
                logger.warning("Redis token consume failed; using memory fallback: %s", exc)

        with self._lock:
            self._purge_expired_locked()
            record = self._memory.pop(token, None)
        return record[0] if record is not None else None

    def _purge_expired_locked(self) -> None:
        now = time.monotonic()
        expired = [token for token, (_, expires_at) in self._memory.items() if expires_at <= now]
        for token in expired:
            self._memory.pop(token, None)


stream_token_store = SingleUseStreamTokenStore()
