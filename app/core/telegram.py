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

async def notify_photographer_submission(
    album_title: str,
    client_name: str,
    chat_id: str,
    selected_count: int = 0,
    total_count: int = 0,
    pin: str = ""
):
    """
    Sends a clean, minimalist real-time notification to the photographer
    when a client completes and submits their photo selections.
    """
    if total_count > 0:
        selection_text = f"{selected_count} of {total_count} Photos"
    elif selected_count > 0:
        selection_text = f"{selected_count} Photos"
    else:
        selection_text = "Completed"

    client_display = client_name.strip() if client_name and client_name.strip() else "Client"

    message = (
        "📸 <b>Photo Selection Submitted</b>\n\n"
        f"👤 <b>Client:</b> {client_display}\n"
        f"📁 <b>Album:</b> {album_title}\n"
        f"✅ <b>Selected:</b> {selection_text}"
    )
    if pin:
        message += f"\n🔑 <b>PIN:</b> {pin}"

    await send_telegram_message(chat_id=chat_id, text=message)
