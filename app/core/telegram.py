import os
import logging
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("photoguard.telegram")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

async def send_telegram_message(chat_id: str, text: str) -> bool:
    """
    Sends an asynchronous message to a Telegram chat via Telegram Bot API using httpx.
    """
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token or not chat_id:
        logger.warning("Telegram notification skipped: TELEGRAM_BOT_TOKEN or chat_id is not configured.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                logger.info(f"Telegram notification sent successfully to chat_id: {chat_id}")
                return True
            else:
                logger.error(f"Telegram API returned status {response.status_code}: {response.text}")
                return False
    except Exception as exc:
        logger.error(f"Failed to transmit Telegram notification to {chat_id}: {exc}")
        return False

async def notify_photographer_submission(album_title: str, client_name: str, chat_id: str):
    """
    Sends a beautifully formatted real-time notification to the photographer
    when a client completes and submits their photo selections.
    """
    message = (
        "📸 <b>PhotoGuard Alert: Photo Selection Submitted!</b>\n\n"
        f"👤 <b>Client:</b> {client_name}\n"
        f"📁 <b>Album:</b> {album_title}\n"
        "🔒 <b>Status:</b> Locked & Finalized\n\n"
        "✨ The client has completed their review. Gallery access is locked and selections are ready for editing & export."
    )
    await send_telegram_message(chat_id=chat_id, text=message)
