from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..common import call_view, ensure_option, get_max_rounds, today, user_names
from ..db import get_db
from ..models import Call, Tag, Teacher, TeacherPhone, User
from ..schemas import PhoneIn, TeacherIn, TeacherPatch
from ..security import current_user
from ..services.derived import teacher_view
from ..services.phones import digits_only

router = APIRouter(prefix="/teachers", tags=["teachers"], dependencies=[Depends(current_user)])


def _load(db: Session, teacher_id: int) -> Teacher:
    t = db.scalar(
        select(Teacher).where(Teacher.id == teacher_id)
        .options(selectinload(Teacher.phones), selectinload(Teacher.tags), selectinload(Teacher.tasks),
                 selectinload(Teacher.calls).selectinload(Call.tags))
    )
    if not t:
        raise HTTPException(404, "Teacher not found")
    return t


def _set_phones(t: Teacher, phones: list[PhoneIn]) -> None:
    t.phones = [TeacherPhone(number=p.number.strip(), label=p.label.strip(), position=i)
                for i, p in enumerate(p for p in phones if p.number.strip())]


def _set_tags(db: Session, t: Teacher, tag_ids: list[int]) -> None:
    t.tags = list(db.scalars(select(Tag).where(Tag.id.in_(tag_ids)))) if tag_ids else []


@router.get("")
def list_teachers(
    db: Session = Depends(get_db),
    q: str = "",
    subject: Optional[str] = None,
    status: Optional[str] = None,
    interest: Optional[str] = None,
    rounds: Optional[int] = Query(None, ge=0, description="number of rounds attempted (0 = never called)"),
    has_phone: Optional[bool] = None,
    checklist: Optional[str] = None,
    assigned_to_id: Optional[int] = None,
    has_open_task: Optional[bool] = None,
    tag_ids: list[int] = Query(default=[]),
):
    max_rounds, today_ = get_max_rounds(db), today()
    teachers = db.scalars(
        select(Teacher).order_by(Teacher.id)
        .options(selectinload(Teacher.phones), selectinload(Teacher.calls), selectinload(Teacher.tasks),
                 selectinload(Teacher.tags))
    ).all()
    out = []
    wanted_tags = set(tag_ids)
    ql = q.strip().lower()
    qd = digits_only(q)
    for t in teachers:
        if ql:
            hit = ql in t.name.lower() or ql in t.subject.lower() or ql in t.notes.lower()
            if not hit and len(qd) >= 3:
                hit = any(qd in digits_only(p.number) for p in t.phones)
            if not hit:
                continue
        if subject and t.subject != subject:
            continue
        if status and t.status != status:
            continue
        if wanted_tags and not wanted_tags & {g.id for g in t.tags}:
            continue
        if checklist is not None and checklist != "" and t.source_checklist != (checklist if checklist != "none" else ""):
            continue
        if assigned_to_id and t.assigned_to_id != assigned_to_id:
            continue
        if has_phone is not None and bool(t.phones) != has_phone:
            continue
        v = teacher_view(t, max_rounds, today_)
        if interest and v["latest_interest"] != interest:
            continue
        if rounds is not None and v["rounds_attempted"] != rounds:
            continue
        if has_open_task is not None and (v["open_task_count"] > 0) != has_open_task:
            continue
        out.append(v)
    return out


@router.post("", status_code=201)
def create_teacher(data: TeacherIn, db: Session = Depends(get_db)):
    t = Teacher(**data.model_dump(exclude={"phones", "tag_ids"}))
    _set_phones(t, data.phones)
    _set_tags(db, t, data.tag_ids)
    ensure_option(db, "subject", t.subject)
    ensure_option(db, "status", t.status)
    db.add(t)
    db.commit()
    return teacher_view(_load(db, t.id), get_max_rounds(db), today())


@router.get("/{teacher_id}")
def get_teacher(teacher_id: int, db: Session = Depends(get_db)):
    t = _load(db, teacher_id)
    names = user_names(db)
    view = teacher_view(t, get_max_rounds(db), today())
    view["calls"] = [call_view(c, names) for c in t.calls]
    return view


@router.patch("/{teacher_id}")
def update_teacher(teacher_id: int, data: TeacherPatch, db: Session = Depends(get_db)):
    t = _load(db, teacher_id)
    changes = data.model_dump(exclude_unset=True)
    phones = data.phones  # keep as models (model_dump turned them into dicts)
    changes.pop("phones", None)
    tag_ids = changes.pop("tag_ids", None)
    for k, v in changes.items():
        if v is None and k not in ("assigned_to_id", "students_per_class", "papers_per_month"):
            continue
        setattr(t, k, v)
    if phones is not None:
        _set_phones(t, phones)
    if tag_ids is not None:
        _set_tags(db, t, tag_ids)
    ensure_option(db, "subject", t.subject)
    ensure_option(db, "status", t.status)
    db.commit()
    return teacher_view(_load(db, teacher_id), get_max_rounds(db), today())


@router.post("/{teacher_id}/phones", status_code=201)
def add_phone(teacher_id: int, data: PhoneIn, db: Session = Depends(get_db)):
    """Add one more number (e.g. the manager's number the hotline just gave us)."""
    t = _load(db, teacher_id)
    if digits_only(data.number) in {digits_only(p.number) for p in t.phones}:
        raise HTTPException(409, "This number is already saved for this teacher")
    t.phones.append(TeacherPhone(number=data.number.strip(), label=data.label.strip(), position=len(t.phones)))
    db.commit()
    return teacher_view(_load(db, teacher_id), get_max_rounds(db), today())


@router.delete("/{teacher_id}", status_code=204)
def delete_teacher(teacher_id: int, db: Session = Depends(get_db)):
    db.delete(_load(db, teacher_id))
    db.commit()
