import os

filepath = "app/core/redis.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Login Rate Limiter patch
old_login = "def check_login_rate_limit(client_ip: str, email: str, max_attempts: int = 5, window_seconds: int = 900)"
new_login = "def check_login_rate_limit(client_ip: str, email: str, max_attempts: int = 50, window_seconds: int = 60)"
content = content.replace(old_login, new_login)

old_login_record = "def record_failed_login_attempt(client_ip: str, email: str, window_seconds: int = 900)"
new_login_record = "def record_failed_login_attempt(client_ip: str, email: str, window_seconds: int = 60)"
content = content.replace(old_login_record, new_login_record)

# PIN Rate Limiter patch
old_pin = "def check_pin_rate_limit(client_ip: str, pin: str, max_attempts: int = 10, window_seconds: int = 900)"
new_pin = "def check_pin_rate_limit(client_ip: str, pin: str, max_attempts: int = 100, window_seconds: int = 60)"
content = content.replace(old_pin, new_pin)

old_pin_record = "def record_failed_pin_attempt(client_ip: str, pin: str, window_seconds: int = 900)"
new_pin_record = "def record_failed_pin_attempt(client_ip: str, pin: str, window_seconds: int = 60)"
content = content.replace(old_pin_record, new_pin_record)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Rate limiters relaxed successfully!")
