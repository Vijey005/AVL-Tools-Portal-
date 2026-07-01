"""
Pydantic schemas for request/response validation.
"""
from datetime import datetime
from typing import Optional, Literal, List

from pydantic import BaseModel, EmailStr, field_serializer

from app.datetime_utils import to_utc_iso


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

    @field_serializer("created_at", when_used="json")
    def serialize_created_at(self, dt: datetime) -> str:
        return to_utc_iso(dt)

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


# ── Password Reset ─────────────────────────────────────

class PasswordResetRequestCreate(BaseModel):
    """User submits their email to request a password reset."""
    email: EmailStr


class PasswordResetReview(BaseModel):
    """Admin approves or rejects a reset request."""
    action: Literal["approve", "reject"]


class PasswordResetConsume(BaseModel):
    """User sets a new password using the approved reset token."""
    token: str
    new_password: str


class PasswordResetRequestOut(BaseModel):
    """Admin-facing view of a reset request."""
    id: int
    user_id: int
    user_email: str
    user_display_name: str
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    @field_serializer("created_at", "reviewed_at", when_used="json")
    def serialize_datetimes(self, dt: Optional[datetime]) -> Optional[str]:
        return to_utc_iso(dt)

    class Config:
        from_attributes = True


# ── Mock Email ─────────────────────────────────────────

class MockEmailOut(BaseModel):
    id: int
    to_email: str
    subject: str
    body: str
    created_at: datetime

    @field_serializer("created_at", when_used="json")
    def serialize_created_at(self, dt: datetime) -> str:
        return to_utc_iso(dt)

    class Config:
        from_attributes = True


# ── Analytics ──────────────────────────────────────────

class ToolBreakdownItem(BaseModel):
    tool_type: str
    label: str
    count: int


class ActivityDayItem(BaseModel):
    date: str
    count: int
    label: Optional[str] = None


class KpiTrend(BaseModel):
    delta_pct: float
    direction: Literal["up", "down", "neutral"]


class RecentProjectItem(BaseModel):
    id: int
    name: str
    tool_type: str
    tool_label: str
    is_owned: bool = True
    updated_at: datetime
    days_since_update: Optional[int] = None

    @field_serializer("updated_at", when_used="json")
    def serialize_updated_at(self, dt: datetime) -> str:
        return to_utc_iso(dt)


class StaleProjectItem(BaseModel):
    id: int
    name: str
    tool_type: str
    tool_label: str
    updated_at: datetime
    days_since_update: Optional[int] = None

    @field_serializer("updated_at", when_used="json")
    def serialize_updated_at(self, dt: datetime) -> str:
        return to_utc_iso(dt)


class ContributorItem(BaseModel):
    display_name: str
    email: str
    project_count: int


class PersonalAnalytics(BaseModel):
    total_projects: int
    shared_with_me: int
    shared_by_me: int
    active_this_week: int
    stale_projects: int
    tool_breakdown: List[ToolBreakdownItem]
    activity_7d: List[ActivityDayItem]
    activity_30d: List[ActivityDayItem]
    recent_projects: List[RecentProjectItem]
    stale_project_list: List[StaleProjectItem]
    trends: dict[str, KpiTrend]


class OrganizationAnalytics(BaseModel):
    total_users: int
    active_users: int
    pending_approval: int
    total_projects: int
    projects_created_7d: int
    projects_updated_7d: int
    collaboration_events: int
    collaboration_rate_pct: float
    tool_breakdown: List[ToolBreakdownItem]
    activity_7d: List[ActivityDayItem]
    activity_30d: List[ActivityDayItem]
    top_contributors: List[ContributorItem]
    trends: dict[str, KpiTrend]


class OperationsAnalytics(BaseModel):
    pending_password_resets: int
    pending_user_approvals: int


class AnalyticsDashboardOut(BaseModel):
    generated_at: datetime
    is_admin: bool
    personal: PersonalAnalytics
    organization: OrganizationAnalytics
    operations: OperationsAnalytics

    @field_serializer("generated_at", when_used="json")
    def serialize_generated_at(self, dt: datetime) -> str:
        return to_utc_iso(dt)

