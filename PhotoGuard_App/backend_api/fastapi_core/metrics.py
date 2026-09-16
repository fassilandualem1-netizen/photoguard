import logging
import os
import threading
from collections import defaultdict
from typing import Any

import redis

logger = logging.getLogger(__name__)
_METRICS_KEY = "photoguard:platform-metrics"


class MetricsCollector:
    """Small Redis-backed counter store with a process-local fallback."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._memory: dict[str, int] = defaultdict(int)
        self._redis: redis.Redis | None = None

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
                logger.info("Redis-backed platform metrics enabled")
            except redis.RedisError as exc:
                logger.warning("Redis metrics unavailable; using memory fallback: %s", exc)
        else:
            logger.warning("REDIS_URL is not configured; using memory metrics")

    def increment(self, name: str, amount: int = 1) -> None:
        if amount <= 0:
            return
        if self._redis is not None:
            try:
                self._redis.hincrby(_METRICS_KEY, name, amount)
                return
            except redis.RedisError as exc:
                logger.warning("Redis metrics write failed; using memory fallback: %s", exc)

        with self._lock:
            self._memory[name] += amount

    def record_request(self, path: str, status_code: int) -> None:
        self.increment("requests.total")
        self.increment(f"requests.status.{status_code}")
        self.increment(f"requests.path.{path}")

    def record_upload(self, photo_count: int, total_bytes: int) -> None:
        self.increment("uploads.photos", photo_count)
        self.increment("uploads.bytes", total_bytes)

    def record_bandwidth(self, transferred_bytes: int) -> None:
        self.increment("bandwidth.bytes", transferred_bytes)

    def record_security_event(self, event: str) -> None:
        self.increment(f"security.{event}")

    def snapshot(self) -> dict[str, Any]:
        values: dict[str, int] = {}
        if self._redis is not None:
            try:
                values = {
                    key: int(value)
                    for key, value in self._redis.hgetall(_METRICS_KEY).items()
                }
            except (redis.RedisError, ValueError) as exc:
                logger.warning("Redis metrics read failed; using memory fallback: %s", exc)

        if not values:
            with self._lock:
                values = dict(self._memory)

        request_volume: dict[str, int] = {}
        security_events: dict[str, int] = {}
        for key, value in values.items():
            if key.startswith("requests.path."):
                request_volume[key.removeprefix("requests.path.")] = value
            elif key.startswith("security."):
                security_events[key.removeprefix("security.")] = value

        return {
            "uploads": {
                "photos": values.get("uploads.photos", 0),
                "bytes": values.get("uploads.bytes", 0),
            },
            "bandwidth": {
                "streamed_bytes": values.get("bandwidth.bytes", 0),
            },
            "requests": {
                "total": values.get("requests.total", 0),
                "by_path": request_volume,
                "by_status": {
                    key.removeprefix("requests.status."): value
                    for key, value in values.items()
                    if key.startswith("requests.status.")
                },
            },
            "security_events": security_events,
        }


metrics = MetricsCollector()
