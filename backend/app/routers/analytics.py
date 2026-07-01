"""
Analytics routes — actionable workspace and organization metrics.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, File, PasswordResetRequest, file_shares
from app.schemas import AnalyticsDashboardOut, KpiTrend

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

TOOL_LABELS = {
    "lmm": "LMM Planner",
    "organigram": "Organigram",
    "dashboard": "Weekly Dashboard",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _days_since(dt: datetime | None, now: datetime) -> int | None:
    dt = _as_utc(dt)
    if dt is None:
        return None
    return max(0, (now - dt).days)


def _pct_change(current: int, previous: int) -> KpiTrend:
    if previous == 0:
        delta = 100.0 if current > 0 else 0.0
    else:
        delta = round((current - previous) / previous * 100, 1)
    if delta > 0:
        direction = "up"
    elif delta < 0:
        direction = "down"
    else:
        direction = "neutral"
    return KpiTrend(delta_pct=abs(delta), direction=direction)


def _activity_buckets(files, now: datetime, days: int, bucket: str):
    """Build activity series — daily for 7d, weekly for 30d."""
    items = []
    if bucket == "day":
        for i in range(days - 1, -1, -1):
            day = (now - timedelta(days=i)).date()
            count = sum(
                1 for f in files
                if _as_utc(f.updated_at) and _as_utc(f.updated_at).date() == day
            )
            items.append({"date": day.isoformat(), "count": count, "label": day.strftime("%a")})
    else:
        for w in range(3, -1, -1):
            end = (now - timedelta(days=w * 7)).date()
            start = (now - timedelta(days=(w + 1) * 7)).date()
            count = sum(
                1 for f in files
                if _as_utc(f.updated_at) and start <= _as_utc(f.updated_at).date() < end
            )
            items.append({"date": end.isoformat(), "count": count, "label": "This wk" if w == 0 else f"W-{w}"})
    return items


def _org_activity_buckets(db: Session, now: datetime, days: int, bucket: str):
    items = []
    if bucket == "day":
        for i in range(days - 1, -1, -1):
            day = (now - timedelta(days=i)).date()
            day_start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
            day_end = day_start + timedelta(days=1)
            count = db.query(File).filter(File.updated_at >= day_start, File.updated_at < day_end).count()
            items.append({"date": day.isoformat(), "count": count, "label": day.strftime("%a")})
    else:
        for w in range(3, -1, -1):
            end_dt = now - timedelta(days=w * 7)
            start_dt = now - timedelta(days=(w + 1) * 7)
            count = db.query(File).filter(File.updated_at >= start_dt, File.updated_at < end_dt).count()
            items.append({
                "date": end_dt.date().isoformat(),
                "count": count,
                "label": "This wk" if w == 0 else f"W-{w}",
            })
    return items


@router.get("/dashboard", response_model=AnalyticsDashboardOut)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return personal and organization metrics for the analytics dashboard."""
    now = _utcnow()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    month_ago = now - timedelta(days=30)
    stale_cutoff = month_ago

    accessible_files = db.query(File).filter(
        or_(
            File.owner_id == current_user.id,
            File.shared_with_users.any(id=current_user.id),
        )
    ).all()

    owned_files = [f for f in accessible_files if f.owner_id == current_user.id]
    received_files = [f for f in accessible_files if f.owner_id != current_user.id]

    active_this_week = [
        f for f in accessible_files if _as_utc(f.updated_at) and _as_utc(f.updated_at) >= week_ago
    ]
    active_prev_week = [
        f for f in accessible_files
        if _as_utc(f.updated_at) and two_weeks_ago <= _as_utc(f.updated_at) < week_ago
    ]
    stale_projects = [
        f for f in owned_files if _as_utc(f.updated_at) and _as_utc(f.updated_at) < stale_cutoff
    ]

    owned_created_7d = sum(
        1 for f in owned_files if _as_utc(f.created_at) and _as_utc(f.created_at) >= week_ago
    )
    owned_created_prev_7d = sum(
        1 for f in owned_files
        if _as_utc(f.created_at) and two_weeks_ago <= _as_utc(f.created_at) < week_ago
    )

    outgoing_clones = db.query(File).filter(File.shared_by_user_id == current_user.id).count()
    outgoing_originals = (
        db.query(func.count())
        .select_from(file_shares.join(File, file_shares.c.file_id == File.id))
        .filter(File.owner_id == current_user.id)
        .scalar()
        or 0
    )

    personal_tool_counts = {t: 0 for t in TOOL_LABELS}
    for f in owned_files:
        personal_tool_counts[f.tool_type] = personal_tool_counts.get(f.tool_type, 0) + 1

    personal_activity_7d = _activity_buckets(accessible_files, now, 7, "day")
    personal_activity_30d = _activity_buckets(accessible_files, now, 30, "week")

    recent_personal = sorted(accessible_files, key=lambda f: f.updated_at, reverse=True)[:8]

    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    pending_approval = db.query(User).filter(User.is_approved == False, User.is_admin == False).count()
    total_projects = db.query(File).count()

    org_tool_rows = db.query(File.tool_type, func.count(File.id)).group_by(File.tool_type).all()
    org_tool_counts = {t: 0 for t in TOOL_LABELS}
    for tool_type, count in org_tool_rows:
        org_tool_counts[tool_type] = count

    projects_created_7d = db.query(File).filter(File.created_at >= week_ago).count()
    projects_created_prev_7d = db.query(File).filter(
        File.created_at >= two_weeks_ago, File.created_at < week_ago
    ).count()
    projects_updated_7d = db.query(File).filter(File.updated_at >= week_ago).count()
    projects_updated_prev_7d = db.query(File).filter(
        File.updated_at >= two_weeks_ago, File.updated_at < week_ago
    ).count()

    shared_clones = db.query(File).filter(File.shared_by_user_id.isnot(None)).count()
    shared_originals = db.query(func.count()).select_from(file_shares).scalar() or 0
    collaboration_total = shared_clones + shared_originals
    collaboration_rate = round((collaboration_total / total_projects * 100), 1) if total_projects else 0.0

    org_activity_7d = _org_activity_buckets(db, now, 7, "day")
    org_activity_30d = _org_activity_buckets(db, now, 30, "week")

    top_contributors = (
        db.query(User.display_name, User.email, func.count(File.id).label("project_count"))
        .join(File, File.owner_id == User.id)
        .filter(User.is_active == True)
        .group_by(User.id)
        .order_by(func.count(File.id).desc())
        .limit(5)
        .all()
    )

    shares_7d = db.query(File).filter(
        File.shared_by_user_id == current_user.id,
        File.created_at >= week_ago,
    ).count()
    shares_prev_7d = db.query(File).filter(
        File.shared_by_user_id == current_user.id,
        File.created_at >= two_weeks_ago,
        File.created_at < week_ago,
    ).count()

    pending_resets = 0
    if current_user.is_admin:
        pending_resets = db.query(PasswordResetRequest).filter(
            PasswordResetRequest.status == "pending"
        ).count()

    return AnalyticsDashboardOut(
        generated_at=now,
        is_admin=current_user.is_admin,
        personal={
            "total_projects": len(owned_files),
            "shared_with_me": len(received_files),
            "shared_by_me": outgoing_clones + outgoing_originals,
            "active_this_week": len(active_this_week),
            "stale_projects": len(stale_projects),
            "tool_breakdown": [
                {"tool_type": k, "label": v, "count": personal_tool_counts[k]}
                for k, v in TOOL_LABELS.items()
            ],
            "activity_7d": personal_activity_7d,
            "activity_30d": personal_activity_30d,
            "recent_projects": [
                {
                    "id": f.id,
                    "name": f.name,
                    "tool_type": f.tool_type,
                    "tool_label": TOOL_LABELS.get(f.tool_type, f.tool_type),
                    "is_owned": f.owner_id == current_user.id,
                    "updated_at": _as_utc(f.updated_at),
                    "days_since_update": _days_since(f.updated_at, now),
                }
                for f in recent_personal
            ],
            "stale_project_list": [
                {
                    "id": f.id,
                    "name": f.name,
                    "tool_type": f.tool_type,
                    "tool_label": TOOL_LABELS.get(f.tool_type, f.tool_type),
                    "updated_at": _as_utc(f.updated_at),
                    "days_since_update": _days_since(f.updated_at, now),
                }
                for f in sorted(stale_projects, key=lambda x: x.updated_at)[:6]
            ],
            "trends": {
                "owned": _pct_change(owned_created_7d, owned_created_prev_7d),
                "active": _pct_change(len(active_this_week), len(active_prev_week)),
                "shared_out": _pct_change(shares_7d, shares_prev_7d),
            },
        },
        organization={
            "total_users": total_users,
            "active_users": active_users,
            "pending_approval": pending_approval,
            "total_projects": total_projects,
            "projects_created_7d": projects_created_7d,
            "projects_updated_7d": projects_updated_7d,
            "collaboration_events": collaboration_total,
            "collaboration_rate_pct": collaboration_rate,
            "tool_breakdown": [
                {"tool_type": k, "label": v, "count": org_tool_counts[k]}
                for k, v in TOOL_LABELS.items()
            ],
            "activity_7d": org_activity_7d,
            "activity_30d": org_activity_30d,
            "top_contributors": [
                {"display_name": name, "email": email, "project_count": count}
                for name, email, count in top_contributors
            ],
            "trends": {
                "created": _pct_change(projects_created_7d, projects_created_prev_7d),
                "updated": _pct_change(projects_updated_7d, projects_updated_prev_7d),
            },
        },
        operations={
            "pending_password_resets": pending_resets,
            "pending_user_approvals": pending_approval if current_user.is_admin else 0,
        },
    )
