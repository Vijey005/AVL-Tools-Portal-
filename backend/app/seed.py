"""
Seed the database with default users on first launch.
Called from main.py during lifespan startup.
"""
from sqlalchemy.orm import Session

from app.models import User
from app.auth import hash_password
from app.config import SEED_USERS


def seed_users(db: Session) -> None:
    """Create seed users if they don't already exist."""
    for user_data in SEED_USERS:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if existing:
            continue

        user = User(
            email=user_data["email"],
            display_name=user_data["display_name"],
            hashed_password=hash_password(user_data["password"]),
            is_admin=user_data["is_admin"],
            is_active=True,
        )
        db.add(user)
        print(f"  [seed] Created user: {user_data['email']} "
              f"({'admin' if user_data['is_admin'] else 'employee'})")

    db.commit()
