import logging
import requests
from config import Config

logger = logging.getLogger(__name__)

class RedisClient:
    """
    Client for interacting with Upstash Redis via its REST API.
    Provides a safe fallback in-memory mock store if credentials are not configured
    to prevent crashes during local development.
    """
    def __init__(self):
        self.url = Config.UPSTASH_REDIS_REST_URL
        self.token = Config.UPSTASH_REDIS_REST_TOKEN
        self.is_mock = not (self.url and self.token)
        self.mock_store = {}
        
        if self.is_mock:
            logger.warning("Upstash Redis REST credentials missing. Initializing safe fallback in-memory mock store.")
        else:
            logger.info("Upstash Redis REST credentials found. Bound to production Redis.")

    def _get_headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def set(self, key, value, ex=None):
        if self.is_mock:
            self.mock_store[key] = value
            return True
        
        try:
            import urllib.parse
            encoded_key = urllib.parse.quote(str(key), safe='')
            encoded_val = urllib.parse.quote(str(value), safe='')
            url = f"{self.url}/set/{encoded_key}/{encoded_val}"
            if ex:
                url += f"/EX/{ex}"
            response = requests.get(url, headers=self._get_headers(), timeout=5)
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Redis SET failed for key '{key}': {e}")
            return False

    def get(self, key):
        if self.is_mock:
            return self.mock_store.get(key)
        
        try:
            import urllib.parse
            encoded_key = urllib.parse.quote(str(key), safe='')
            url = f"{self.url}/get/{encoded_key}"
            response = requests.get(url, headers=self._get_headers(), timeout=5)
            response.raise_for_status()
            data = response.json()
            return data.get("result")
        except Exception as e:
            logger.error(f"Redis GET failed for key '{key}': {e}")
            return None

# Singleton instance to be used across the application
redis_client = RedisClient()
