"""
User authentication routes — register, login, profile.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import EMAIL_MODE, smtp_is_configured
from app.models import User, PasswordResetRequest, MockEmail
from app.schemas import (
    UserRegister, UserLogin, Token, UserOut, UserSearchOut,
    PasswordResetRequestCreate, PasswordResetConsume, MockEmailOut,
)
from app.auth import hash_password, verify_password, create_access_token, get_current_user, get_optional_user
from app.notifications import notify_admins

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: UserRegister, db: Session = Depends(get_db)):
    """Create a new user account."""
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        display_name=body.display_name,
        hashed_password=hash_password(body.password),
        is_admin=False,
        is_active=True,
        is_approved=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "Registration successful. Please wait for an admin to approve your account."}


@router.post("/login", response_model=Token)
def login(body: UserLogin, db: Session = Depends(get_db)):
    """Validate credentials and return a JWT."""
    user = db.query(User).filter(func.lower(User.email) == body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact your administrator.",
        )
    if not user.is_approved and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending admin approval.",
        )

    token = create_access_token(user.id)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.get("/search", response_model=List[UserSearchOut])
def search_users(q: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Search active, approved users by email or display name."""
    if not q or len(q.strip()) < 2:
        return []

    search_term = f"%{q.strip().lower()}%"
    users = db.query(User).filter(
        User.id != current_user.id,
        User.is_active == True,
        User.is_approved == True,
        (User.email.ilike(search_term)) | (User.display_name.ilike(search_term))
    ).limit(10).all()

    return users


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(body: PasswordResetRequestCreate, db: Session = Depends(get_db)):
    """Submit a password reset request. Requires admin approval before the user can reset."""
    email = body.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
        return {"message": "If the email is registered, a password reset request has been submitted for admin approval."}

    existing = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.user_id == user.id,
        PasswordResetRequest.status == "pending",
    ).first()

    if existing:
        return {"message": "A password reset request is already pending admin approval."}

    reset_req = PasswordResetRequest(user_id=user.id, status="pending")
    db.add(reset_req)
    db.flush()

    notify_admins(
        db,
        subject="New Password Reset Request",
        body=(
            f"{user.display_name} ({user.email}) submitted a forgot-password request.\n"
            "Review and approve or reject it in the Admin Dashboard → Password Requests."
        ),
    )
    db.commit()

    return {"message": "Password reset request submitted. Please wait for an admin to approve it."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(body: PasswordResetConsume, db: Session = Depends(get_db)):
    """Use an approved reset token to set a new password."""
    reset_req = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.reset_token == body.token,
        PasswordResetRequest.status == "approved",
    ).first()

    if not reset_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    user = db.query(User).filter(User.id == reset_req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from datetime import datetime, timezone
    user.hashed_password = hash_password(body.new_password)
    reset_req.status = "used"
    reset_req.used_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Password has been reset successfully. You can now log in with your new password."}


@router.get("/debug/emails", response_model=List[MockEmailOut])
def get_debug_emails(
    email: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Retrieve simulated emails for the logged-in user or a supplied email address."""
    mode = EMAIL_MODE if EMAIL_MODE in {"mock", "smtp", "auto"} else "auto"
    if mode == "smtp" or (mode == "auto" and smtp_is_configured()):
        raise HTTPException(status_code=404, detail="Simulated inbox is disabled in SMTP mode.")

    query = db.query(MockEmail)

    if current_user:
        query = query.filter(func.lower(MockEmail.to_email) == current_user.email.lower())
    elif email and email.strip():
        query = query.filter(func.lower(MockEmail.to_email) == email.strip().lower())
    else:
        return []

    return query.order_by(MockEmail.created_at.desc()).all()
