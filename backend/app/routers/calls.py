from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..common import call_view, set_actions, user_names
from ..db import get_db
from ..models import Call, Option, Tag, Task, Teacher, TeacherPhone, User
from ..schemas import CallIn, CallPatch
from ..security import current_user
from ..services.derived import status_after_call
from ..services.phones import digits_only

router = APIRouter(prefix="/calls", tags=["calls"])


def _get(db: Session, call_id: int) -> Call:
    c = db.scalar(select(Call).where(Call.id == call_id).options(selectinload(Call.teacher), selectinload(Call.tags)))
    if not c:
        raise HTTPException(404, "Call not found")
    return c


@router.get("")
def list_calls(
    db: Session = Depends(get_db), _: User = Depends(current_user),
    q: str = "", teacher_id: Optional[int] = None, round: Optional[int] = None,
    outcome: Optional[str] = None, user_id: Optional[int] = None,
    date_from: Optional[date] = None, date_to: Optional[date] = None,
    tag_ids: list[int] = Query(default=[]),
):
    stmt = select(Call).join(Teacher).options(selectinload(Call.teacher), selectinload(Call.tags))
    if tag_ids:  # tagged on the call itself, or the teacher carries the tag
        stmt = stmt.where(Call.tags.any(Tag.id.in_(tag_ids)) | Teacher.tags.any(Tag.id.in_(tag_ids)))
    if q.strip():
        stmt = stmt.where(Teacher.name.ilike(f"%{q.strip()}%") | Call.notes.ilike(f"%{q.strip()}%"))
    if teacher_id:
        stmt = stmt.where(Call.teacher_id == teacher_id)
    if round:
        stmt = stmt.where(Call.round == round)
    if outcome:
        stmt = stmt.where(Call.outcome == outcome)
    if user_id:
        stmt = stmt.where(Call.created_by_id == user_id)
    if date_from:
        stmt = stmt.where(Call.called_date >= date_from)
    if date_to:
        stmt = stmt.where(Call.called_date <= date_to)
    stmt = stmt.order_by(Call.called_date.desc(), Call.called_time.desc(), Call.id.desc())
    names = user_names(db)
    return [call_view(c, names) for c in db.scalars(stmt)]


@router.post("", status_code=201)
def create_call(data: CallIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    teacher = db.get(Teacher, data.teacher_id)
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    attempt = (db.scalar(
        select(func.count(Call.id)).where(Call.teacher_id == teacher.id, Call.round == data.round)
    ) or 0) + 1
    call = Call(**data.model_dump(exclude={"create_tasks", "tag_ids", "new_phone", "next_actions", "next_action"}),
                attempt=attempt, created_by_id=user.id)
    set_actions(call, data.next_actions or ([data.next_action] if data.next_action else []))
    call.tags = list(db.scalars(select(Tag).where(Tag.id.in_(data.tag_ids)))) if data.tag_ids else []
    db.add(call)
    db.flush()
    valid = set(db.scalars(select(Option.value).where(Option.category == "status")))
    teacher.status = status_after_call(teacher.status, call.interest_level, call.outcome, call.spoke_to, valid)
    np = data.new_phone
    if np and np.number.strip() and digits_only(np.number) not in {digits_only(p.number) for p in teacher.phones}:
        teacher.phones.append(TeacherPhone(number=np.number.strip(), label=np.label.strip(),
                                           position=len(teacher.phones)))
    for t in data.create_tasks:
        fields = t.model_dump(exclude={"teacher_id"})
        fields["assigned_to_id"] = fields["assigned_to_id"] or user.id
        db.add(Task(**fields, teacher_id=teacher.id, source_call_id=call.id, created_by_id=user.id))
    db.commit()
    return call_view(_get(db, call.id), user_names(db))


@router.patch("/{call_id}")
def update_call(call_id: int, data: CallPatch, db: Session = Depends(get_db), _: User = Depends(current_user)):
    call = _get(db, call_id)
    changes = data.model_dump(exclude_unset=True)
    tag_ids = changes.pop("tag_ids", None)
    actions = changes.pop("next_actions", None)
    legacy = changes.pop("next_action", None)
    if actions is not None or legacy is not None:
        set_actions(call, actions if actions is not None else ([legacy] if legacy else []))
    if tag_ids is not None:
        call.tags = list(db.scalars(select(Tag).where(Tag.id.in_(tag_ids)))) if tag_ids else []
    if "round" in changes and changes["round"] != call.round:
        call.attempt = (db.scalar(
            select(func.count(Call.id)).where(Call.teacher_id == call.teacher_id, Call.round == changes["round"])
        ) or 0) + 1
    for k, v in changes.items():
        if v is None and k not in ("called_time", "price_proposed", "counter_offer", "followup_date"):
            continue
        setattr(call, k, v)
    db.commit()
    return call_view(_get(db, call_id), user_names(db))


@router.delete("/{call_id}", status_code=204)
def delete_call(call_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    db.delete(_get(db, call_id))
    db.commit()
