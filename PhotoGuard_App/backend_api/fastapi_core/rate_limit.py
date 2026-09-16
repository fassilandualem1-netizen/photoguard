import logging
import os

import redis
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

def _storage_uri() -> str:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        logger.warning("REDIS_URL is not configured; using an in-memory rate-limit store")
        return "memory://"

    try:
        client = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        client.ping()
        client.close()
        logger.info("Redis-backed rate limiting enabled")
        return redis_url
    except redis.RedisError as exc:
        logger.warning(
            "Redis is unavailable; using an in-memory rate-limit store: %s", exc
        )
        return "memory://"


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_storage_uri(),
    key_prefix="photoguard:rate-limit",
)
