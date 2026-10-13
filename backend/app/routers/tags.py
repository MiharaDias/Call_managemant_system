from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..common import tag_view
from ..db import get_db
from ..models import Tag
from ..schemas import TagIn, TagPatch
from ..security import current_user

router = APIRouter(prefix="/tags", tags=["tags"], dependencies=[Depends(current_user)])


def _unique(db: Session, name: str, except_id: int | None = None) -> None:
    other = db.scalar(select(Tag).where(Tag.name.ilike(name.strip())))
    if other and other.id != except_id:
        raise HTTPException(409, f"A tag called “{other.name}” already exists")


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    return [tag_view(t) for t in db.scalars(select(Tag).order_by(Tag.name))]


@router.post("", status_code=201)
def create_tag(data: TagIn, db: Session = Depends(get_db)):
    _unique(db, data.name)
    t = Tag(name=data.name.strip(), color=data.color, description=data.description.strip())
    db.add(t)
    db.commit()
    return tag_view(t)


@router.patch("/{tag_id}")
def update_tag(tag_id: int, data: TagPatch, db: Session = Depends(get_db)):
    t = db.get(Tag, tag_id)
    if not t:
        raise HTTPException(404, "Tag not found")
    if data.name is not None:
        _unique(db, data.name, tag_id)
        t.name = data.name.strip()
    if data.color is not None:
        t.color = data.color
    if data.description is not None:
        t.description = data.description.strip()
    db.commit()
    return tag_view(t)


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    t = db.get(Tag, tag_id)
    if not t:
        raise HTTPException(404, "Tag not found")
    db.delete(t)  # rows linking it to teachers/calls are removed by the database (ON DELETE CASCADE)
    db.commit()
