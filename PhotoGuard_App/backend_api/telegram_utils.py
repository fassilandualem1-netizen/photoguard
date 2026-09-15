import os
import logging
import threading
import requests

logger = logging.getLogger(__name__)

# Default PhotoGuard Studio Bot Token fallback
DEFAULT_TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')

def send_telegram_message(chat_id: str, text_message: str) -> tuple:
    """
    Send a formatted HTML message to a Telegram Chat ID via Telegram Bot API.
    Returns tuple: (success: bool, status_message: str)
    """
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN') or DEFAULT_TELEGRAM_BOT_TOKEN
    
    if not bot_token:
        err = "TELEGRAM_BOT_TOKEN environment variable is not configured on server."
        logger.warning(f"[TELEGRAM WARNING] {err}")
        return False, err
        
    if not chat_id:
        err = "No Telegram Chat ID provided."
        logger.warning(f"[TELEGRAM WARNING] {err}")
        return False, err

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": str(chat_id).strip(),
        "text": text_message,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }

    try:
        response = requests.post(url, json=payload, timeout=8)
        data = response.json() if 'application/json' in response.headers.get('Content-Type', '') else {}
        if response.status_code == 200 and data.get('ok'):
            logger.info(f"Successfully sent Telegram alert to Chat ID {chat_id}.")
            return True, "Message delivered successfully."
        else:
            description = data.get('description') or f"HTTP {response.status_code}: {response.text}"
            err_msg = f"Telegram API Error: {description}"
            logger.error(f"Telegram API error for Chat ID {chat_id}: {err_msg}")
            return False, err_msg
    except Exception as e:
        err_msg = f"Network connection error to Telegram API: {e}"
        logger.error(f"Failed to send Telegram message to Chat ID {chat_id}: {e}")
        return False, err_msg

def send_telegram_message_async(chat_id: str, text_message: str):
    """
    Asynchronously dispatch a Telegram message in a background thread to prevent
    any delay or blocking on client HTTP responses.
    """
    if not chat_id:
        return
    thread = threading.Thread(target=send_telegram_message, args=(chat_id, text_message), daemon=True)
    thread.start()
