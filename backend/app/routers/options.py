import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..common import DEFAULT_OPTIONS, ensure_option, get_calendar_types, get_max_rounds
from ..db import get_db
from ..models import Option, Setting
from ..schemas import OptionAdd, OptionsIn
from ..security import current_user

router = APIRouter(prefix="/options", tags=["options"], dependencies=[Depends(current_user)])


def _read(db: Session) -> dict:
    out: dict[str, list[str]] = {c: [] for c in DEFAULT_OPTIONS}
    for o in db.scalars(select(Option).order_by(Option.category, Option.sort, Option.id)):
        out.setdefault(o.category, []).append(o.value)
    return {"options": out, "max_rounds": get_max_rounds(db), "calendar_types": get_calendar_types(db)}


def _setting(db: Session, key: str, value: str) -> None:
    s = db.get(Setting, key)
    if s:
        s.value = value
    else:
        db.add(Setting(key=key, value=value))


@router.get("")
def get_options(db: Session = Depends(get_db)):
    return _read(db)


@router.put("")
def put_options(data: OptionsIn, db: Session = Depends(get_db)):
    for cat, values in data.options.items():
        if cat not in DEFAULT_OPTIONS:
            continue
        seen: list[str] = []
        for v in values:
            v = v.strip()
            if v and v not in seen:
                seen.append(v)
        db.execute(delete(Option).where(Option.category == cat))
        db.flush()
        for i, v in enumerate(seen):
            db.add(Option(category=cat, value=v, sort=i))
    if data.max_rounds is not None:
        _setting(db, "max_rounds", str(data.max_rounds))
    if data.calendar_types is not None:
        _setting(db, "calendar_types", json.dumps(data.calendar_types))
    db.commit()
    return _read(db)


@router.post("/{category}", status_code=201)
def add_option(category: str, data: OptionAdd, db: Session = Depends(get_db)):
    """Add one value to a dropdown list (used by the “+ Add new…” entries in forms)."""
    if category not in DEFAULT_OPTIONS:
        raise HTTPException(404, "Unknown list")
    ensure_option(db, category, data.value)
    db.commit()
    return _read(db)
