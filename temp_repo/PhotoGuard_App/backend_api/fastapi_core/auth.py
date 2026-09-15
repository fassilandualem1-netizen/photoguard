import os
import hmac
import hashlib
import jwt
from datetime import datetime, timedelta
from typing import Dict, Any

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super_secret_jwt_key_photoguard")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

def verify_telegram_auth(data: Dict[str, Any], bot_token: str) -> bool:
    """Verifies the integrity of the data received from Telegram Login Widget."""
    if 'hash' not in data:
        return False
        
    received_hash = data.pop('hash')
    
    # Sort key-value pairs alphabetically by key
    data_check_arr = []
    for key in sorted(data.keys()):
        if key != 'hash':
            data_check_arr.append(f"{key}={data[key]}")
            
    data_check_string = '\n'.join(data_check_arr)
    
    # Calculate secret key from bot token
    secret_key = hashlib.sha256(bot_token.encode('utf-8')).digest()
    
    # Calculate HMAC-SHA256 signature
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Put hash back in case the dict is reused
    data['hash'] = received_hash
    
    return hmac.compare_digest(calculated_hash, received_hash)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
