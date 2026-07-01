"""
Admin-only routes — user management.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, PasswordResetRequest
from app.schemas import UserOut, UserUpdate, PasswordResetReview, PasswordResetRequestOut
from app.auth import require_admin
from app.notifications import (
    send_mock_email,
    password_reset_approved_body,
    password_reset_rejected_body,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=List[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List every registered user (admin only)."""
    return db.query(User).order_by(User.id).all()


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Toggle admin/active/approved status or update display name (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")
    if user.id == admin.id and body.is_admin is False:
        raise HTTPException(status_code=400, detail="You cannot revoke your own admin privileges")
    if user.id == admin.id and body.is_approved is False:
        raise HTTPException(status_code=400, detail="You cannot unapprove your own account")

    if body.is_admin is not None:
        user.is_admin = body.is_admin
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.is_approved is not None:
        user.is_approved = body.is_approved
    if body.display_name is not None:
        user.display_name = body.display_name

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Permanently delete a user and their files (admin only)."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()


# ── Password Reset Request Management ──────────────────

@router.get("/reset-requests", response_model=List[PasswordResetRequestOut])
def list_reset_requests(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all password reset requests (pending first, then recent)."""
    from sqlalchemy import case
    requests = db.query(PasswordResetRequest).join(User).order_by(
        case(
            (PasswordResetRequest.status == "pending", 0),
            else_=1,
        ),
        PasswordResetRequest.created_at.desc(),
    ).all()

    return [
        PasswordResetRequestOut(
            id=req.id,
            user_id=req.user_id,
            user_email=req.user.email,
            user_display_name=req.user.display_name,
            status=req.status,
            created_at=req.created_at,
            reviewed_at=req.reviewed_at,
        )
        for req in requests
    ]


@router.put("/reset-requests/{request_id}")
def review_reset_request(
    request_id: int,
    body: PasswordResetReview,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Approve or reject a password reset request."""
    from datetime import datetime, timezone

    reset_req = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.id == request_id,
    ).first()

    if not reset_req:
        raise HTTPException(status_code=404, detail="Reset request not found")

    if reset_req.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Request has already been {reset_req.status}",
        )

    user = db.query(User).filter(User.id == reset_req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User associated with request not found")

    reset_req.reviewed_at = datetime.now(timezone.utc)

    if body.action == "approve":
        reset_req.status = "approved"
        token = reset_req.generate_token()

        send_mock_email(
            db,
            user.email,
            "Password Reset Approved",
            password_reset_approved_body(token),
        )
        db.commit()

        return {"message": "Reset request approved. A reset link was sent to the user's email."}

    reset_req.status = "rejected"
    send_mock_email(
        db,
        user.email,
        "Password Reset Rejected",
        password_reset_rejected_body(),
    )
    db.commit()

    return {"message": "Reset request rejected. An email notification was sent to the user."}
