"""
User authentication routes — register, login, profile.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from typing import List
from app.schemas import UserRegister, UserLogin, Token, UserOut, UserSearchOut
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: UserRegister, db: Session = Depends(get_db)):
    """Create a new user account."""
    # Check for existing email
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
    user = db.query(User).filter(User.email == body.email).first()
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
