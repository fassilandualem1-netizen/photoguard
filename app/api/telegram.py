import os
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.core.dependencies import get_current_user
from app.core.telegram import send_telegram_message

logger = logging.getLogger("photoguard.telegram")

router = APIRouter(prefix="/api/telegram", tags=["Telegram Integration"])

@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Telegram Webhook Receiver.
    Processes incoming updates from Telegram Bot API.
    When a photographer clicks the deep link:
      https://t.me/Photoguard_alert_bot?start={user.id}
    and taps 'Start', Telegram sends:
      /start {user.id}
    This endpoint parses the user.id, verifies the photographer in PostgreSQL,
    stores their telegram_chat_id, and sends an instant welcome confirmation message.
    """
    try:
        payload = await request.json()
    except Exception as exc:
        logger.warning(f"[Telegram Webhook] Failed to parse incoming JSON payload: {exc}")
        return {"ok": False, "detail": "Invalid JSON"}

    # Extract update details
    message = payload.get("message") or payload.get("edited_message")
    if not message:
        # Ignore non-message updates (inline queries, channel posts, etc.)
        return {"ok": True, "status": "ignored"}

    chat = message.get("chat", {})
    chat_id = chat.get("id")
    text = (message.get("text") or "").strip()
    from_user = message.get("from", {})
    first_name = from_user.get("first_name", "Photographer")

    if not chat_id:
        return {"ok": True, "status": "no_chat_id"}

    logger.info(f"[Telegram Webhook] Received message from chat_id={chat_id}: '{text}'")

    # Handle /start command with user_id parameter (Deep Linking)
    if text.startswith("/start"):
        parts = text.split()
        if len(parts) > 1:
            raw_param = parts[1].strip()
            # Clean parameter (supports "12", "user_12", etc.)
            clean_id_str = raw_param.replace("user_", "").replace("user", "").strip()
            try:
                user_id = int(clean_id_str)
            except ValueError:
                user_id = None

            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    user.telegram_chat_id = str(chat_id)
                    db.commit()
                    db.refresh(user)
                    logger.info(f"[Telegram Webhook] Successfully linked Photographer #{user.id} ({user.email}) to Telegram Chat ID: {chat_id}")

                    welcome_msg = (
                        "🎉 <b>PhotoGuard Telegram Alerts Connected!</b>\n\n"
                        f"Welcome, <b>{user.full_name or first_name}</b>!\n"
                        f"Your Telegram account is now successfully linked to your PhotoGuard studio profile (<code>{user.email}</code>).\n\n"
                        "⚡ <b>What happens now:</b>\n"
                        "The instant any client reviews, locks, and submits their photo selections, you will receive a real-time alert with album details right here!\n\n"
                        "<i>You can return to your PhotoGuard dashboard now.</i>"
                    )
                    await send_telegram_message(chat_id=str(chat_id), text=welcome_msg)
                    return {"ok": True, "status": "linked", "user_id": user.id, "chat_id": chat_id}
                else:
                    logger.warning(f"[Telegram Webhook] User ID {user_id} not found in database.")
                    not_found_msg = (
                        "⚠️ <b>PhotoGuard Studio Account Not Found</b>\n\n"
                        f"We could not locate an active photographer account matching ID <code>{user_id}</code>.\n"
                        "Please return to your PhotoGuard Dashboard, open Settings > Telegram Integration, and click the deep link button again."
                    )
                    await send_telegram_message(chat_id=str(chat_id), text=not_found_msg)
                    return {"ok": True, "status": "user_not_found"}
            else:
                generic_msg = (
                    "👋 <b>Welcome to PhotoGuard Alerts Bot!</b>\n\n"
                    "To link this bot to your Photographer account, please open your "
                    "<b>PhotoGuard Dashboard</b>, click <b>Settings</b>, and tap <b>Connect Telegram</b>."
                )
                await send_telegram_message(chat_id=str(chat_id), text=generic_msg)
                return {"ok": True, "status": "invalid_parameter"}
        else:
            # Plain /start with no parameters
            generic_msg = (
                "👋 <b>Welcome to PhotoGuard Alerts Bot!</b>\n\n"
                "To link this bot to your Photographer account, please open your "
                "<b>PhotoGuard Dashboard</b>, click <b>Settings</b>, and tap <b>Connect Telegram</b>."
            )
            await send_telegram_message(chat_id=str(chat_id), text=generic_msg)
            return {"ok": True, "status": "start_no_param"}

    elif text.startswith("/disconnect") or text.startswith("/unlink"):
        user = db.query(User).filter(User.telegram_chat_id == str(chat_id)).first()
        if user:
            user.telegram_chat_id = None
            db.commit()
            db.refresh(user)
            await send_telegram_message(
                chat_id=str(chat_id),
                text="🔒 <b>PhotoGuard Alerts Disconnected:</b> Your account has been unlinked from this Telegram chat."
            )
            return {"ok": True, "status": "unlinked"}
        else:
            await send_telegram_message(
                chat_id=str(chat_id),
                text="ℹ️ This chat is not currently connected to any active PhotoGuard account."
            )
            return {"ok": True, "status": "not_linked"}

    return {"ok": True, "status": "ignored"}


@router.get("/status")
def get_telegram_status(current_user: User = Depends(get_current_user)):
    """
    Returns the Telegram connection status for the logged-in user.
    """
    raw_bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "Photoguard_alert_bot")
    clean_bot_username = raw_bot_username.replace("@", "").strip()
    return {
        "is_connected": bool(current_user.telegram_chat_id),
        "chat_id": current_user.telegram_chat_id,
        "bot_username": clean_bot_username,
        "deep_link": f"https://t.me/{clean_bot_username}?start={current_user.id}"
    }


@router.post("/unlink")
def unlink_telegram_chat(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Disconnects Telegram alerts for the logged-in user.
    """
    current_user.telegram_chat_id = None
    db.commit()
    db.refresh(current_user)
    return {"message": "Telegram account disconnected successfully."}
