"""
File CRUD routes + sharing/cloning endpoint.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, File
from app.schemas import FileCreate, FileUpdate, FileOut, FileListItem, ShareRequest
from app.auth import get_current_user

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("", response_model=List[FileListItem])
def list_my_files(
    tool_type: Optional[str] = Query(None, description="Filter by tool type: lmm, organigram, dashboard"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all files owned by the current user, optionally filtered by tool type."""
    query = db.query(File).filter(File.owner_id == current_user.id)
    if tool_type:
        query = query.filter(File.tool_type == tool_type)
    return query.order_by(File.updated_at.desc()).all()


@router.post("", response_model=FileOut, status_code=status.HTTP_201_CREATED)
def create_file(
    body: FileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new file for the current user."""
    if body.tool_type not in ("lmm", "organigram", "dashboard"):
        raise HTTPException(status_code=400, detail="Invalid tool_type")

    file = File(
        owner_id=current_user.id,
        tool_type=body.tool_type,
        name=body.name,
        json_payload=body.json_payload,
    )
    db.add(file)
    db.commit()
    db.refresh(file)
    return file


@router.get("/{file_id}", response_model=FileOut)
def get_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a specific file (must be owned by the current user)."""
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return file


@router.put("/{file_id}", response_model=FileOut)
def update_file(
    file_id: int,
    body: FileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a file's name and/or JSON payload."""
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if body.name is not None:
        file.name = body.name
    if body.json_payload is not None:
        file.json_payload = body.json_payload

    db.commit()
    db.refresh(file)
    return file


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a file owned by the current user."""
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(file)
    db.commit()


@router.post("/{file_id}/share", status_code=status.HTTP_201_CREATED)
def share_file(
    file_id: int,
    body: ShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Clone a file and assign it to another user.

    - Verifies the sender owns the file
    - Looks up the recipient by email
    - Creates a COMPLETE DUPLICATE with the recipient as owner
    - Appends "(Shared)" to the file name
    - Tracks who shared it using shared_by_user_id
    """
    # 1. Verify sender owns the file
    source_file = db.query(File).filter(File.id == file_id).first()
    if not source_file:
        raise HTTPException(status_code=404, detail="File not found")
    if source_file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only share your own files")

    # 2. Look up recipient
    recipient = db.query(User).filter(User.email == body.target_email).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found. They must register first.")
    if not recipient.is_active:
        raise HTTPException(status_code=400, detail="Recipient account is disabled")
    if recipient.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot share a file with yourself")

    # 3. Create a complete duplicate
    cloned_file = File(
        owner_id=recipient.id,
        tool_type=source_file.tool_type,
        name=f"{source_file.name} (Shared)",
        json_payload=source_file.json_payload,
        shared_by_user_id=current_user.id,
    )
    db.add(cloned_file)
    db.commit()
    db.refresh(cloned_file)

    return {"message": "File shared successfully"}
