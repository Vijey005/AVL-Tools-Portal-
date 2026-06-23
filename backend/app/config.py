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
