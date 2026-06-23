"""
SQLAlchemy ORM models — Users and Files.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, Text, DateTime, ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    display_name = Column(String(255), nullable=False, default="")
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationship to files
    files = relationship("File", back_populates="owner", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} email={self.email!r}>"


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_type = Column(String(20), nullable=False, index=True)       # 'lmm' | 'organigram' | 'dashboard'
    name = Column(String(255), nullable=False)
    json_payload = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationship to owner
    owner = relationship("User", back_populates="files")

    def __repr__(self):
        return f"<File id={self.id} name={self.name!r} tool={self.tool_type}>"
