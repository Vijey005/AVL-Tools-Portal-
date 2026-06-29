"""
Pydantic schemas for request/response validation.
"""
from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr


# ── Auth ───────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    display_name: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int


# ── User responses ────────────────────────────────────

class UserSearchOut(BaseModel):
    id: int
    email: EmailStr
    display_name: str

    class Config:
        orm_mode = True


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    is_admin: bool
    is_active: bool
    is_approved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Admin-only: toggle fields on a user."""
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    is_approved: Optional[bool] = None
    display_name: Optional[str] = None


# ── Files ──────────────────────────────────────────────

class FileCreate(BaseModel):
    tool_type: Literal["lmm", "organigram", "dashboard"]
    name: str
    json_payload: str = "{}"


class FileUpdate(BaseModel):
    name: Optional[str] = None
    json_payload: Optional[str] = None


class FileOut(BaseModel):
    id: int
    owner_id: int
    tool_type: str
    name: str
    json_payload: str
    shared_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FileListItem(BaseModel):
    """Lightweight version without the full JSON payload."""
    id: int
    owner_id: int
    tool_type: str
    name: str
    shared_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShareRequest(BaseModel):
    target_email: EmailStr
    share_type: Literal["duplicate", "original"] = "duplicate"
