"""
SQLAlchemy ORM models — Users, Files, and Password Reset Requests.
"""
import secrets
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, Text, DateTime, ForeignKey, Table
)
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


file_shares = Table(
    "file_shares",
    Base.metadata,
    Column("file_id", Integer, ForeignKey("files.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    display_name = Column(String(255), nullable=False, default="")
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationship to files
    files = relationship("File", back_populates="owner", cascade="all, delete-orphan", foreign_keys="File.owner_id")

    def __repr__(self):
        return f"<User id={self.id} email={self.email!r}>"


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shared_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    tool_type = Column(String(20), nullable=False, index=True)       # 'lmm' | 'organigram' | 'dashboard'
    name = Column(String(255), nullable=False)
    json_payload = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="files", foreign_keys=[owner_id])
    shared_by_user = relationship("User", foreign_keys=[shared_by_user_id])
    shared_with_users = relationship("User", secondary=file_shares, backref="shared_files_ref")

    def __repr__(self):
        return f"<File id={self.id} name={self.name!r} tool={self.tool_type}>"


class PasswordResetRequest(Base):
    """Tracks forgot-password requests that require admin approval."""
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # status: pending → approved/rejected.  Once user consumes the token → used.
    status = Column(String(20), default="pending", nullable=False, index=True)
    # Secure token generated when admin approves — user needs this to set new password
    reset_token = Column(String(128), unique=True, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    used_at = Column(DateTime, nullable=True)

    # Relationship
    user = relationship("User", backref="reset_requests")

    def generate_token(self):
        """Generate a secure reset token when approved."""
        self.reset_token = secrets.token_urlsafe(48)
        return self.reset_token

    def __repr__(self):
        return f"<PasswordResetRequest id={self.id} user_id={self.user_id} status={self.status!r}>"


class PasswordChangeRequest(Base):
    """Tracks logged-in password change requests that require admin approval."""
    __tablename__ = "password_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # The new password, hashed so it's secure in the DB
    hashed_password = Column(String(255), nullable=False)
    reason = Column(Text, nullable=True)
    # status: pending → approved / rejected
    status = Column(String(20), default="pending", nullable=False, index=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    # Relationship
    user = relationship("User", backref="change_requests")

    def __repr__(self):
        return f"<PasswordChangeRequest id={self.id} user_id={self.user_id} status={self.status!r}>"


class MockEmail(Base):
    """Simulates real-world email notifications sent to users."""
    __tablename__ = "mock_emails"

    id = Column(Integer, primary_key=True, index=True)
    to_email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    def __repr__(self):
        return f"<MockEmail id={self.id} to={self.to_email!r} subject={self.subject!r}>"
