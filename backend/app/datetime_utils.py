"""UTC datetime helpers for consistent API serialization."""
from datetime import datetime, timezone
from typing import Optional


def to_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Serialize a datetime as UTC ISO-8601 with a Z suffix."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
