"""
Application configuration — secrets, paths, token settings.
"""
import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent          # backend/
DATABASE_URL = f"sqlite:///{BASE_DIR / 'avl_tools.db'}"

# ── JWT ────────────────────────────────────────────────
SECRET_KEY = os.getenv(
    "AVL_SECRET_KEY",
    "avl-portal-dev-secret-key-change-in-production-2026"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24   # 24 hours

# ── Frontend (for reset links in simulated emails) ─────
FRONTEND_URL = os.getenv("AVL_FRONTEND_URL", "http://localhost:4200")

# ── Email delivery (production-ready) ───────────────────
# AVL_EMAIL_MODE:
#   - "mock": always write to mock_emails table (dev/testing)
#   - "smtp": always send through SMTP (production)
#   - "auto": SMTP when configured, otherwise mock
EMAIL_MODE = os.getenv("AVL_EMAIL_MODE", "auto").strip().lower()
SMTP_HOST = os.getenv("AVL_SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("AVL_SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("AVL_SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("AVL_SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("AVL_SMTP_USE_TLS", "true").strip().lower() in {"1", "true", "yes", "on"}
SMTP_USE_SSL = os.getenv("AVL_SMTP_USE_SSL", "false").strip().lower() in {"1", "true", "yes", "on"}
SMTP_TIMEOUT_SECONDS = float(os.getenv("AVL_SMTP_TIMEOUT_SECONDS", "10"))

MAIL_FROM_EMAIL = os.getenv("AVL_MAIL_FROM_EMAIL", "no-reply@avltools.local").strip()
MAIL_FROM_NAME = os.getenv("AVL_MAIL_FROM_NAME", "AVL Tools Portal").strip()


def smtp_is_configured() -> bool:
    """True when minimum SMTP config is present."""
    return bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD and MAIL_FROM_EMAIL)

# ── Seed users (created on first launch) ──────────────
SEED_USERS = [
    {
        "email": "admin@avl.com",
        "display_name": "AVL Admin",
        "password": "admin123",
        "is_admin": True,
    },
    {
        "email": "john.doe@avl.com",
        "display_name": "John Doe",
        "password": "password",
        "is_admin": False,
    },
    {
        "email": "jane.smith@avl.com",
        "display_name": "Jane Smith",
        "password": "password",
        "is_admin": False,
    },
]
