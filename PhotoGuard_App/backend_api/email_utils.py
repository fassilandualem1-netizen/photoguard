import smtplib
import logging
import os
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config

logger = logging.getLogger(__name__)

def build_reset_email_html(to_email: str, temp_password: str) -> str:
    """Build a modern, glassmorphic HTML email template for password resets."""
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PhotoGuard Password Reset</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #f3f4f6;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
            <td align="center" style="padding: 40px 10px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 32px 32px 16px 32px; background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);">
                            <h1 style="margin: 0; font-size: 26px; font-weight: 800; background: linear-gradient(to right, #22d3ee, #60a5fa); -webkit-background-clip: text; color: #22d3ee;">PhotoGuard Studio</h1>
                            <p style="margin-top: 6px; font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Security Notification</p>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px;">
                            <p style="margin-top: 0; font-size: 15px; color: #e5e7eb; line-height: 1.6;">
                                Hello,
                            </p>
                            <p style="font-size: 14px; color: #9ca3af; line-height: 1.6;">
                                We received a password reset request for your PhotoGuard account (<strong style="color: #22d3ee;">{to_email}</strong>). Your account access password has been temporarily reset to:
                            </p>
                            <!-- Password Box -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                                <tr>
                                    <td align="center" style="background-color: #030712; border: 1px dashed #06b6d4; border-radius: 12px; padding: 18px;">
                                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 24px; font-weight: 700; color: #22d3ee; letter-spacing: 4px;">{temp_password}</span>
                                    </td>
                                </tr>
                            </table>
                            <p style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
                                Please use this temporary password to log in and update your password immediately in your studio settings.
                            </p>
                            <!-- Login Button -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 28px;">
                                <tr>
                                    <td align="center">
                                        <a href="https://photoguard.onrender.com/login" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(to right, #06b6d4, #2563eb); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 10px 15px -3px rgba(6, 182, 212, 0.3);">
                                            Login to PhotoGuard
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px; background-color: #030712; border-top: 1px solid #1f2937; font-size: 12px; color: #6b7280;">
                            If you did not request this password reset, please contact system security immediately.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

def send_reset_password_email(to_email: str, temp_password: str) -> bool:
    """
    Send temporary password reset email via SMTP.
    Returns True if sent successfully, False otherwise.
    """
    smtp_server = Config.SMTP_SERVER
    smtp_port = Config.SMTP_PORT
    smtp_user = Config.SMTP_USERNAME
    smtp_pass = Config.SMTP_PASSWORD
    sender_email = Config.SENDER_EMAIL or 'noreply@photoguard.com'

    if not smtp_user or not smtp_pass:
        logger.warning(f"[SMTP WARNING] SMTP_USERNAME or SMTP_PASSWORD not configured. Skipping live email delivery to {to_email}. Temporary Password: {temp_password}")
        return False

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Your PhotoGuard Temporary Password"
        msg['From'] = f"PhotoGuard Security <{sender_email}>"
        msg['To'] = to_email

        text_content = f"Your temporary password for PhotoGuard is: {temp_password}\n\nPlease login and update your password immediately."
        html_content = build_reset_email_html(to_email, temp_password)

        msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))

        with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(sender_email, [to_email], msg.as_string())

        logger.info(f"Successfully sent password reset email to {to_email}.")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email to {to_email}: {e}")
        return False

def send_reset_password_email_async(to_email: str, temp_password: str):
    """Dispatch email sending in a non-blocking background thread."""
    thread = threading.Thread(target=send_reset_password_email, args=(to_email, temp_password), daemon=True)
    thread.start()
