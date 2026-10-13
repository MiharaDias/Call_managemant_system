from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..common import get_calendar_types, task_view, today, user_names
from ..db import get_db
from ..models import Task, Teacher, User
from ..schemas import TaskIn, TaskPatch
from ..security import current_user

router = APIRouter(prefix="/tasks", tags=["tasks"])

_order = (Task.due_date, Task.due_time.is_(None), Task.due_time, Task.id)


def _base():
    return select(Task).options(selectinload(Task.teacher).selectinload(Teacher.phones))


def _get(db: Session, task_id: int) -> Task:
    t = db.scalar(_base().where(Task.id == task_id))
    if not t:
        raise HTTPException(404, "Task not found")
    return t


@router.get("")
def list_tasks(
    db: Session = Depends(get_db), _: User = Depends(current_user),
    status: Optional[str] = None, type: Optional[str] = None, overdue: Optional[bool] = None,
    assigned_to_id: Optional[int] = None, teacher_id: Optional[int] = None,
    date_from: Optional[date] = None, date_to: Optional[date] = None, q: str = "",
):
    stmt = _base().outerjoin(Teacher)
    now = today()
    if status in ("open", "done"):
        stmt = stmt.where(Task.status == status)
    if type:
        stmt = stmt.where(Task.type == type)
    if overdue:
        stmt = stmt.where(Task.status == "open", Task.due_date < now)
    if assigned_to_id:
        stmt = stmt.where(Task.assigned_to_id == assigned_to_id)
    if teacher_id:
        stmt = stmt.where(Task.teacher_id == teacher_id)
    if date_from:
        stmt = stmt.where(Task.due_date >= date_from)
    if date_to:
        stmt = stmt.where(Task.due_date <= date_to)
    if q.strip():
        stmt = stmt.where(Task.title.ilike(f"%{q.strip()}%") | Teacher.name.ilike(f"%{q.strip()}%"))
    names = user_names(db)
    return [task_view(t, names, now) for t in db.scalars(stmt.order_by(*_order))]


@router.get("/agenda")
def agenda(date_: Optional[date] = Query(None, alias="date"), assigned_to_id: Optional[int] = None,
           db: Session = Depends(get_db), _: User = Depends(current_user)):
    """Everything for one day: overdue carry-over (only when viewing today or later), the day's tasks."""
    now = today()
    day = date_ or now
    names = user_names(db)

    def run(*conds):
        stmt = _base().where(*conds)
        if assigned_to_id:
            stmt = stmt.where(Task.assigned_to_id == assigned_to_id)
        return [task_view(t, names, now) for t in db.scalars(stmt.order_by(*_order))]

    overdue = run(Task.status == "open", Task.due_date < now) if day >= now else []
    return {"date": day, "today": now, "overdue": overdue, "tasks": run(Task.due_date == day)}


@router.get("/calendar")
def calendar(start: date, end: date, db: Session = Depends(get_db), _: User = Depends(current_user)):
    names, now = user_names(db), today()
    # only task types chosen in Settings (default: calls and meetings) appear on the calendar
    stmt = (_base().where(Task.due_date >= start, Task.due_date <= end, Task.type.in_(get_calendar_types(db)))
            .order_by(*_order))
    return [task_view(t, names, now) for t in db.scalars(stmt)]


@router.post("", status_code=201)
def create_task(data: TaskIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if data.teacher_id and not db.get(Teacher, data.teacher_id):
        raise HTTPException(404, "Teacher not found")
    t = Task(**data.model_dump(), created_by_id=user.id)
    if t.assigned_to_id is None:
        t.assigned_to_id = user.id
    db.add(t)
    db.commit()
    return task_view(_get(db, t.id), user_names(db), today())


@router.patch("/{task_id}")
def update_task(task_id: int, data: TaskPatch, db: Session = Depends(get_db), user: User = Depends(current_user)):
    t = _get(db, task_id)
    changes = data.model_dump(exclude_unset=True)
    clear_time = changes.pop("clear_time", False)
    new_status = changes.pop("status", None)
    for k, v in changes.items():
        if v is None and k not in ("assigned_to_id", "teacher_id"):
            continue
        setattr(t, k, v)
    if clear_time:
        t.due_time = None
    if new_status and new_status != t.status:
        t.status = new_status
        if new_status == "done":
            t.completed_at, t.completed_by_id = datetime.now(), user.id
        else:
            t.completed_at = t.completed_by_id = None
    db.commit()
    return task_view(_get(db, task_id), user_names(db), today())


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    db.delete(_get(db, task_id))
    db.commit()
