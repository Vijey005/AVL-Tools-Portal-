"""
Email helpers — production SMTP delivery with dev-safe mock fallback.
"""
import smtplib
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.config import (
    FRONTEND_URL,
    EMAIL_MODE,
    MAIL_FROM_EMAIL,
    MAIL_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_TIMEOUT_SECONDS,
    SMTP_USERNAME,
    SMTP_USE_SSL,
    SMTP_USE_TLS,
    smtp_is_configured,
)
from app.models import MockEmail, User


def send_mock_email(db: Session, to_email: str, subject: str, body: str) -> MockEmail:
    """Record a simulated email and log it to the console."""
    mock_email = MockEmail(to_email=to_email, subject=subject, body=body)
    db.add(mock_email)
    print(
        f"\n========================================\n"
        f"[EMAIL SIMULATION] Sent to: {to_email}\n"
        f"Subject: {subject}\n"
        f"Body:\n{body}\n"
        f"========================================\n"
    )
    return mock_email


def _build_message(to_email: str, subject: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{MAIL_FROM_NAME} <{MAIL_FROM_EMAIL}>"
    msg["To"] = to_email
    msg.set_content(body)
    return msg


def _send_smtp_email(to_email: str, subject: str, body: str) -> None:
    msg = _build_message(to_email, subject, body)

    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        return

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
        server.ehlo()
        if SMTP_USE_TLS:
            server.starttls()
            server.ehlo()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)


def send_email(db: Session, to_email: str, subject: str, body: str) -> None:
    """
    Send email using configured mode:
      - smtp: must send real mail
      - mock: always simulated mail
      - auto: smtp when configured, otherwise simulated mail
    """
    mode = EMAIL_MODE if EMAIL_MODE in {"mock", "smtp", "auto"} else "auto"

    if mode == "mock":
        send_mock_email(db, to_email, subject, body)
        return

    if mode == "auto" and not smtp_is_configured():
        send_mock_email(db, to_email, subject, body)
        return

    if not smtp_is_configured():
        raise RuntimeError(
            "SMTP mode enabled but SMTP config is incomplete. "
            "Set AVL_SMTP_HOST, AVL_SMTP_USERNAME, AVL_SMTP_PASSWORD, and AVL_MAIL_FROM_EMAIL."
        )

    _send_smtp_email(to_email, subject, body)


def notify_admins(db: Session, subject: str, body: str) -> None:
    """Notify every active admin by email (smtp or mock based on config)."""
    admins = db.query(User).filter(User.is_admin == True, User.is_active == True).all()
    for admin in admins:
        send_email(db, admin.email, subject, body)


def reset_link(token: str) -> str:
    return f"{FRONTEND_URL}/login?token={token}"


def password_reset_approved_body(token: str) -> str:
    return (
        "Your password reset request has been approved.\n"
        f"Click here to reset your password: {reset_link(token)}\n\n"
        "If you did not request this reset, please contact your administrator immediately."
    )


def password_reset_rejected_body() -> str:
    return (
        "Your password reset request has been rejected.\n"
        "Please contact your administrator if you believe this is a mistake."
    )
