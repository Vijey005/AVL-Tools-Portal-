"""
Mock email helpers — simulates outbound notifications for dev/testing.
"""
from sqlalchemy.orm import Session

from app.config import FRONTEND_URL
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


def notify_admins(db: Session, subject: str, body: str) -> None:
    """Send a simulated notification to every active admin."""
    admins = db.query(User).filter(User.is_admin == True, User.is_active == True).all()
    for admin in admins:
        send_mock_email(db, admin.email, subject, body)


def reset_link(token: str) -> str:
    return f"{FRONTEND_URL}/login?token={token}"


def password_reset_approved_body(token: str) -> str:
    return (
        "Your password reset request has been approved.\n"
        f"Click here to reset your password: {reset_link(token)}"
    )


def password_reset_rejected_body() -> str:
    return "Your password reset request has been rejected."
